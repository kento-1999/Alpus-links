const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderMeta = require('../models/OrderMeta');
const Post = require('../models/Post');
const LinkInsertion = require('../models/LinkInsertion');
const Website = require('../models/Website');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Helper function to attach order meta to orders
async function attachOrderMeta(orders) {
  // Handle both single order and array of orders
  const ordersArray = Array.isArray(orders) ? orders : [orders];
  
  // Get all order IDs
  const orderIds = ordersArray.map(order => order._id.toString());
  
  // Fetch all order meta records for these orders
  const orderMetaRecords = await OrderMeta.find({
    orderId: { $in: orderIds }
  });
  
  // Create a map of orderId -> meta records
  const metaMap = {};
  orderMetaRecords.forEach(meta => {
    const orderId = meta.orderId.toString();
    if (!metaMap[orderId]) {
      metaMap[orderId] = {};
    }
    metaMap[orderId][meta.meta_property] = meta.meta_value;
  });
  
  // Attach meta to each order
  ordersArray.forEach(order => {
    const orderId = order._id.toString();
    const meta = metaMap[orderId] || {};
    
    // Attach rejectionReason if it exists
    if (meta.rejectionReason) {
      order.rejectionReason = meta.rejectionReason;
    }
    
    // Attach other meta properties if needed
    Object.keys(meta).forEach(key => {
      if (key !== 'rejectionReason') {
        order[key] = meta[key];
      }
    });
  });
  
  return Array.isArray(orders) ? ordersArray : ordersArray[0];
}

// Create a new order (place order from cart)
router.post('/', auth, async (req, res) => {
  try {
    const { items } = req.body; // Array of cart items
    const advertiserId = req.user.id;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart items are required'
      });
    }

    // Calculate total order amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.price || 0;
    }

    // Check advertiser balance
    const advertiser = await User.findById(advertiserId);
    if (!advertiser) {
      return res.status(404).json({
        success: false,
        message: 'Advertiser not found'
      });
    }

    const currentBalance = advertiser.balance || 0;
    if (currentBalance < totalAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Your balance is $${currentBalance.toFixed(2)}, but order total is $${totalAmount.toFixed(2)}`
      });
    }

    // Deduct balance from advertiser
    advertiser.balance = currentBalance - totalAmount;
    await advertiser.save();

    const createdOrders = [];

    for (const item of items) {
      const { websiteId, type, price, selectedPostId } = item;

      // Get website details to find publisher
      const website = await Website.findById(websiteId);
      if (!website) {
        return res.status(404).json({
          success: false,
          message: `Website with ID ${websiteId} not found`
        });
      }

      // Create order
      const orderData = {
        advertiserId,
        publisherId: website.publisherId,
        websiteId,
        type,
        price,
        status: 'requested'
      };

      // Add post or link insertion reference based on type
      if ((type === 'guestPost' || type === 'writingGuestPost') && selectedPostId) {
        orderData.postId = selectedPostId;
      } else if (type === 'linkInsertion' && selectedPostId) {
        orderData.linkInsertionId = selectedPostId;
      }

      const order = new Order(orderData);
      
      // Add initial timeline entry
      order.timeline.push({
        status: 'requested',
        timestamp: new Date(),
        note: 'Order placed',
        updatedBy: advertiserId
      });

      await order.save();
      createdOrders.push(order);
    }

    res.status(201).json({
      success: true,
      message: 'Orders placed successfully',
      data: {
        orders: createdOrders,
        count: createdOrders.length
      }
    });

  } catch (error) {
    console.error('Error creating orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create orders',
      error: error.message
    });
  }
});

// Get orders for publisher (task management)
router.get('/publisher', auth, async (req, res) => {
  try {
    const publisherId = req.user.id;
    const { status, page = 1, limit = 10, search = '' } = req.query;

    const query = { publisherId };
    
    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get raw orders first to access linkInsertionId for link insertion orders
    const rawOrders = await Order.find(query)
      .lean()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Populate orders
    const orders = await Order.find(query)
      .populate('advertiserId', 'firstName lastName email company')
      .populate('websiteId', 'domain url')
      .populate('postId', 'title content')
      .populate('linkInsertionId', 'anchorText anchorUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // For link insertion orders, linkInsertionId contains the Post ID
    // So we need to also populate postId for link insertion orders
    // For writingGuestPost orders, try to find post if postId is missing
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const rawOrder = rawOrders[i];
      
      if (order.type === 'linkInsertion' && !order.postId && rawOrder?.linkInsertionId) {
        // Get the raw linkInsertionId value (it's a Post ID, not LinkInsertion ID)
        let postIdStr = null;
        
        // Handle different formats of linkInsertionId
        if (rawOrder.linkInsertionId instanceof mongoose.Types.ObjectId) {
          postIdStr = rawOrder.linkInsertionId.toString();
        } else if (typeof rawOrder.linkInsertionId === 'string') {
          postIdStr = rawOrder.linkInsertionId;
        } else if (rawOrder.linkInsertionId && rawOrder.linkInsertionId.toString) {
          postIdStr = rawOrder.linkInsertionId.toString();
        }
        
        if (postIdStr) {
          // This ID is actually a Post ID, so populate it as postId
          const post = await Post.findById(postIdStr)
            .select('title content');
          
          if (post) {
            order.postId = post;
          }
        }
      } else if (order.type === 'writingGuestPost') {
        // Check if postId exists but is not populated (just an ObjectId)
        if (!order.postId && rawOrder?.postId) {
          const postIdStr = rawOrder.postId instanceof mongoose.Types.ObjectId 
            ? rawOrder.postId.toString() 
            : rawOrder.postId;
          
          if (postIdStr) {
            try {
              const post = await Post.findById(postIdStr).select('title content');
              if (post) {
                order.postId = post;
              }
            } catch (error) {
              console.error('Error fetching post by ID for writingGuestPost order:', error);
            }
          }
        }
        
        // If still no postId, try to find by matching domain and advertiser (simplified for list view)
        if (!order.postId) {
          try {
            const websiteDomain = order.websiteId?.domain || order.websiteId?.url || '';
            const normalizedWebsiteDomain = websiteDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
            
            // Find most recent post for this advertiser with matching domain
            const matchedPost = await Post.findOne({
              advertiserId: order.advertiserId._id || order.advertiserId,
              postType: 'writing-gp'
            })
              .select('title content')
              .sort({ createdAt: -1 });
            
            if (matchedPost) {
              order.postId = matchedPost;
            }
          } catch (error) {
            console.error('Error finding post for writingGuestPost order in list:', error);
          }
        }
      }
    }

    const total = await Order.countDocuments(query);

    // Attach order meta to orders
    const ordersWithMeta = await attachOrderMeta(orders);

    res.json({
      success: true,
      data: {
        orders: ordersWithMeta,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching publisher orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Get orders for advertiser
router.get('/advertiser', auth, async (req, res) => {
  try {
    const advertiserId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { advertiserId };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get raw orders first to access linkInsertionId for link insertion orders
    const rawOrders = await Order.find(query)
      .lean()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Populate orders
    const orders = await Order.find(query)
      .populate('publisherId', 'firstName lastName email')
      .populate('websiteId', 'domain url')
      .populate('postId', 'title content')
      .populate('linkInsertionId', 'anchorText anchorUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // For link insertion orders, linkInsertionId contains the Post ID
    // So we need to also populate postId for link insertion orders
    // For writingGuestPost orders, try to find post if postId is missing
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const rawOrder = rawOrders[i];
      
      if (order.type === 'linkInsertion' && !order.postId && rawOrder?.linkInsertionId) {
        // Get the raw linkInsertionId value (it's a Post ID, not LinkInsertion ID)
        const postIdStr = rawOrder.linkInsertionId.toString();
        
        if (postIdStr) {
          // This ID is actually a Post ID, so populate it as postId
          const post = await Post.findById(postIdStr);
          if (post) {
            order.postId = post;
          }
        }
      } else if (order.type === 'writingGuestPost') {
        // Check if postId exists but is not populated (just an ObjectId)
        if (!order.postId && rawOrder?.postId) {
          const postIdStr = rawOrder.postId instanceof mongoose.Types.ObjectId 
            ? rawOrder.postId.toString() 
            : rawOrder.postId;
          
          if (postIdStr) {
            try {
              const post = await Post.findById(postIdStr).select('title content');
              if (post) {
                order.postId = post;
              }
            } catch (error) {
              console.error('Error fetching post by ID for writingGuestPost order:', error);
            }
          }
        }
        
        // If still no postId, try to find by matching domain and advertiser (simplified for list view)
        if (!order.postId) {
          try {
            const websiteDomain = order.websiteId?.domain || order.websiteId?.url || '';
            const normalizedWebsiteDomain = websiteDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
            
            // Find most recent post for this advertiser with matching domain
            const matchedPost = await Post.findOne({
              advertiserId: order.advertiserId._id || order.advertiserId,
              postType: 'writing-gp'
            })
              .select('title content')
              .sort({ createdAt: -1 });
            
            if (matchedPost) {
              order.postId = matchedPost;
            }
          } catch (error) {
            console.error('Error finding post for writingGuestPost order in list:', error);
          }
        }
      }
    }

    const total = await Order.countDocuments(query);

    // Attach order meta to orders
    const ordersWithMeta = await attachOrderMeta(orders);

    res.json({
      success: true,
      data: {
        orders: ordersWithMeta,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching advertiser orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Update order status (accept/reject by publisher)
router.patch('/:orderId/status', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note, rejectionReason } = req.body;
    const userId = req.user.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user is authorized to update this order
    // Publishers can update orders they received
    // Advertisers can only approve/reject orders in 'advertiserApproval' status
    const isPublisher = order.publisherId.toString() === userId;
    const isAdvertiser = order.advertiserId.toString() === userId;
    
    if (!isPublisher && !isAdvertiser) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this order'
      });
    }
    
    // Advertisers can only approve/reject orders in advertiserApproval status
    if (isAdvertiser && order.status !== 'advertiserApproval') {
      return res.status(403).json({
        success: false,
        message: 'You can only approve or reject orders that are pending your approval'
      });
    }
    
    // Advertisers can only transition to completed or rejected
    if (isAdvertiser && !['completed', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'You can only approve (complete) or reject orders'
      });
    }

    // Validate status transition based on user role
    const validTransitions = {
      'requested': ['inProgress', 'rejected'],
      'inProgress': ['advertiserApproval', 'rejected'],
      'advertiserApproval': ['completed', 'rejected'],
      'completed': [],
      'rejected': []
    };

    // For advertisers, we already checked they can only approve/reject advertiserApproval orders
    // So we don't need to validate transitions for them
    if (isPublisher && !validTransitions[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${order.status} to ${status}`
      });
    }

    // Store old status to check if balance needs to be adjusted
    const oldStatus = order.status;

    // Update order status
    await order.updateStatus(status, note, userId);

    // Handle balance logic based on status change
    // Only process balance changes if status actually changed
    if (status === 'completed' && oldStatus !== 'completed') {
      // Add balance to publisher when order is completed
      // Only if order wasn't already completed (to avoid double payment)
      const publisher = await User.findById(order.publisherId);
      if (publisher) {
        publisher.balance = (publisher.balance || 0) + order.price;
        await publisher.save();
      }
    } else if (status === 'rejected' && oldStatus !== 'rejected') {
      // Refund balance to advertiser when order is rejected
      // Only if order wasn't already rejected (to avoid double refund)
      // But only if order wasn't completed (if completed, publisher already got paid)
      if (oldStatus !== 'completed') {
        const advertiser = await User.findById(order.advertiserId);
        if (advertiser) {
          advertiser.balance = (advertiser.balance || 0) + order.price;
          await advertiser.save();
        }
      }
    }

    // If rejected, save rejection reason in OrderMeta
    if (status === 'rejected' && rejectionReason) {
      // Find existing rejection reason meta or create new one
      await OrderMeta.findOneAndUpdate(
        { orderId: orderId, meta_property: 'rejectionReason' },
        { meta_value: rejectionReason },
        { upsert: true, new: true }
      );
    }

    // Update related post or link insertion status
    if (order.postId && (status === 'inProgress' || status === 'completed')) {
      await Post.findByIdAndUpdate(order.postId, { 
        status: status === 'inProgress' ? 'inProgress' : 'approved' 
      });
    }

    if (order.linkInsertionId && (status === 'inProgress' || status === 'completed')) {
      await LinkInsertion.findByIdAndUpdate(order.linkInsertionId, { 
        status: status === 'inProgress' ? 'inProgress' : 'approved' 
      });
    }

    // Populate the updated order
    const updatedOrder = await Order.findById(orderId)
      .populate('advertiserId', 'firstName lastName email company')
      .populate('publisherId', 'firstName lastName email')
      .populate('websiteId', 'domain url')
      .populate('postId', 'title content')
      .populate('linkInsertionId', 'anchorText anchorUrl');

    // Attach order meta to updated order
    const orderWithMeta = await attachOrderMeta(updatedOrder);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order: orderWithMeta }
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
});

// Get all orders for admin/super admin
router.get('/admin', auth, async (req, res) => {
  try {
    const userRole = req.user.role?.name;
    
    // Check if user is admin or super admin
    if (!['admin', 'super admin'].includes(userRole?.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { 
      status, 
      page = 1, 
      limit = 20, 
      search = '',
      advertiserId,
      publisherId,
      type,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by advertiser if provided
    if (advertiserId) {
      query.advertiserId = advertiserId;
    }

    // Filter by publisher if provided
    if (publisherId) {
      query.publisherId = publisherId;
    }

    // Filter by type if provided
    if (type && type !== 'all') {
      query.type = type;
    }

    // Search functionality
    if (search) {
      // Search in notes and rejectionReason (both old field and OrderMeta)
      const searchConditions = [
        { notes: { $regex: search, $options: 'i' } },
        { rejectionReason: { $regex: search, $options: 'i' } }
      ];
      
      // Also search in OrderMeta for rejectionReason
      const orderMetaRecords = await OrderMeta.find({
        meta_property: 'rejectionReason',
        meta_value: { $regex: search, $options: 'i' }
      });
      
      if (orderMetaRecords.length > 0) {
        const orderIdsFromMeta = orderMetaRecords.map(meta => meta.orderId);
        searchConditions.push({ _id: { $in: orderIdsFromMeta } });
      }
      
      query.$or = searchConditions;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const orders = await Order.find(query)
      .populate('advertiserId', 'firstName lastName email company')
      .populate('publisherId', 'firstName lastName email')
      .populate('websiteId', 'domain url')
      .populate('postId', 'title content')
      .populate('linkInsertionId', 'anchorText anchorUrl')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    // Attach order meta to orders
    const ordersWithMeta = await attachOrderMeta(orders);

    // Get order statistics
    const stats = await Order.aggregate([
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }},
      { $group: {
        _id: null,
        stats: { $push: { status: '$_id', count: '$count' } },
        total: { $sum: '$count' }
      }}
    ]);

    res.json({
      success: true,
      data: {
        orders: ordersWithMeta,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        stats: stats[0] || { stats: [], total: 0 }
      }
    });

  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Update order status by admin
router.patch('/admin/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note, rejectionReason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role?.name;

    // Check if user is admin or super admin
    if (!['admin', 'super admin'].includes(userRole?.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Store old status to check if balance needs to be adjusted
    const oldStatus = order.status;

    // Update order status
    await order.updateStatus(status, note, userId);

    // Handle balance logic based on status change
    if (status === 'completed' && oldStatus !== 'completed') {
      // Add balance to publisher when order is completed
      const publisher = await User.findById(order.publisherId);
      if (publisher) {
        publisher.balance = (publisher.balance || 0) + order.price;
        await publisher.save();
      }
    } else if (status === 'rejected' && oldStatus !== 'rejected') {
      // Refund balance to advertiser when order is rejected
      const advertiser = await User.findById(order.advertiserId);
      if (advertiser) {
        advertiser.balance = (advertiser.balance || 0) + order.price;
        await advertiser.save();
      }
    }

    // Save note (statusNote) to OrderMeta as internalNote
    if (note && note.trim()) {
      await OrderMeta.findOneAndUpdate(
        { orderId: orderId, meta_property: 'internalNote' },
        { meta_value: note },
        { upsert: true, new: true }
      );
    }

    // If rejected, save rejection reason in OrderMeta
    if (status === 'rejected' && rejectionReason) {
      // Find existing rejection reason meta or create new one
      await OrderMeta.findOneAndUpdate(
        { orderId: orderId, meta_property: 'rejectionReason' },
        { meta_value: rejectionReason },
        { upsert: true, new: true }
      );
    }

    // Update related post or link insertion status
    if (order.postId && (status === 'inProgress' || status === 'completed')) {
      await Post.findByIdAndUpdate(order.postId, { 
        status: status === 'inProgress' ? 'inProgress' : 'approved' 
      });
    }

    if (order.linkInsertionId && (status === 'inProgress' || status === 'completed')) {
      await LinkInsertion.findByIdAndUpdate(order.linkInsertionId, { 
        status: status === 'inProgress' ? 'inProgress' : 'approved' 
      });
    }

    // Populate the updated order
    const updatedOrder = await Order.findById(orderId)
      .populate('advertiserId', 'firstName lastName email company')
      .populate('publisherId', 'firstName lastName email')
      .populate('websiteId', 'domain url')
      .populate('postId', 'title content')
      .populate('linkInsertionId', 'anchorText anchorUrl');

    // Attach order meta to updated order
    const orderWithMeta = await attachOrderMeta(updatedOrder);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order: orderWithMeta }
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
});

// Get order details
router.get('/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Get raw order first to access linkInsertionId for link insertion orders
    const rawOrder = await Order.findById(orderId).lean();

    if (!rawOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = await Order.findById(orderId)
      .populate('advertiserId', 'firstName lastName email company')
      .populate('publisherId', 'firstName lastName email')
      .populate('websiteId', 'domain url')
      .populate('postId', 'title content metaTitle metaDescription keywords completeUrl anchorPairs description domain slug')
      .populate('linkInsertionId', 'anchorText anchorUrl');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user is authorized to view this order
    if (order.advertiserId._id.toString() !== userId && order.publisherId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this order'
      });
    }

    // For link insertion orders, linkInsertionId contains the Post ID
    // So we need to also populate postId for link insertion orders
    if (order.type === 'linkInsertion') {
      // Check if postId is already populated, if not, try to populate from linkInsertionId
      if (!order.postId && rawOrder?.linkInsertionId) {
        // Get the raw linkInsertionId value (it's a Post ID, not LinkInsertion ID)
        let postIdStr = null;
        
        // Handle different formats of linkInsertionId
        if (rawOrder.linkInsertionId instanceof mongoose.Types.ObjectId) {
          postIdStr = rawOrder.linkInsertionId.toString();
        } else if (typeof rawOrder.linkInsertionId === 'string') {
          postIdStr = rawOrder.linkInsertionId;
        } else if (rawOrder.linkInsertionId && rawOrder.linkInsertionId.toString) {
          postIdStr = rawOrder.linkInsertionId.toString();
        }
        
        console.log('Link insertion order - postIdStr:', postIdStr);
        
        if (postIdStr) {
          // This ID is actually a Post ID, so populate it as postId
          const post = await Post.findById(postIdStr)
            .select('title content metaTitle metaDescription keywords completeUrl anchorPairs description domain slug');
          
          console.log('Found post for link insertion:', post ? post._id : 'not found');
          
          if (post) {
            order.postId = post;
          }
        } else {
          console.log('No postIdStr extracted from linkInsertionId:', rawOrder.linkInsertionId);
        }
      } else if (!order.postId) {
        console.log('Link insertion order but no postId or linkInsertionId:', {
          hasPostId: !!order.postId,
          hasLinkInsertionId: !!rawOrder?.linkInsertionId,
          rawOrderLinkInsertionId: rawOrder?.linkInsertionId
        });
      }
    }
    
    // For writingGuestPost orders, try to find post if postId is missing or not populated
    if (order.type === 'writingGuestPost') {
      // Check if postId exists but is not populated (just an ObjectId)
      let postIdStr = null;
      if (!order.postId && rawOrder?.postId) {
        // postId exists in raw order but wasn't populated
        if (rawOrder.postId instanceof mongoose.Types.ObjectId) {
          postIdStr = rawOrder.postId.toString();
        } else if (typeof rawOrder.postId === 'string') {
          postIdStr = rawOrder.postId;
        }
        
        if (postIdStr) {
          try {
            const post = await Post.findById(postIdStr)
              .select('title content metaTitle metaDescription keywords completeUrl anchorPairs description domain slug');
            if (post) {
              order.postId = post;
              console.log('Found and populated post for writingGuestPost order:', {
                orderId: order._id,
                postId: post._id,
                title: post.title
              });
            }
          } catch (error) {
            console.error('Error fetching post by ID for writingGuestPost order:', error);
          }
        }
      }
      
      // If still no postId, try to find by matching domain and advertiser
      if (!order.postId) {
        try {
          // Get website domain for matching
          const websiteDomain = order.websiteId?.domain || order.websiteId?.url || '';
          const normalizedWebsiteDomain = websiteDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
          
          // Find posts by matching advertiser, postType, and domain
          const matchingPosts = await Post.find({
            advertiserId: order.advertiserId._id || order.advertiserId,
            postType: 'writing-gp'
          })
            .select('title content metaTitle metaDescription keywords completeUrl anchorPairs description domain slug')
            .sort({ createdAt: -1 }) // Get most recent first
            .limit(10);
          
          // Try to find exact domain match first
          let matchedPost = matchingPosts.find(post => {
            if (post.domain) {
              const postDomain = post.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
              return postDomain === normalizedWebsiteDomain;
            }
            if (post.completeUrl) {
              try {
                const urlObj = new URL(post.completeUrl.startsWith('http') ? post.completeUrl : `https://${post.completeUrl}`);
                const postDomain = urlObj.hostname.replace(/^www\./, '').toLowerCase();
                return postDomain === normalizedWebsiteDomain;
              } catch (e) {
                return false;
              }
            }
            return false;
          });
          
          // If no exact match, use the most recent post for this advertiser
          if (!matchedPost && matchingPosts.length > 0) {
            matchedPost = matchingPosts[0];
          }
          
          if (matchedPost) {
            console.log('Found post for writingGuestPost order by domain matching:', {
              orderId: order._id,
              postId: matchedPost._id,
              title: matchedPost.title,
              domain: matchedPost.domain || matchedPost.completeUrl
            });
            order.postId = matchedPost;
          } else {
            console.log('No post found for writingGuestPost order:', {
              orderId: order._id,
              advertiserId: order.advertiserId._id || order.advertiserId,
              websiteDomain: normalizedWebsiteDomain,
              searchedPosts: matchingPosts.length
            });
          }
        } catch (error) {
          console.error('Error finding post for writingGuestPost order:', error);
        }
      }
    }

    // Attach order meta to order
    const orderWithMeta = await attachOrderMeta(order);

    res.json({
      success: true,
      data: { order: orderWithMeta }
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
});

// Get orders by userId (for admin to view all orders for a specific user)
router.get('/admin/by-user/:userId', auth, async (req, res) => {
  try {
    const userRole = req.user.role?.name;
    
    // Check if user is admin or super admin
    if (!['admin', 'super admin'].includes(userRole?.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find orders where user is either advertiser or publisher
    const orders = await Order.find({
      $or: [
        { advertiserId: userId },
        { publisherId: userId }
      ]
    })
      .populate('advertiserId', 'firstName lastName email company')
      .populate('publisherId', 'firstName lastName email')
      .populate('websiteId', 'domain url')
      .populate('postId', 'title content')
      .populate('linkInsertionId', 'anchorText anchorUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments({
      $or: [
        { advertiserId: userId },
        { publisherId: userId }
      ]
    });

    // Attach order meta to orders
    const ordersWithMeta = await attachOrderMeta(orders);

    res.json({
      success: true,
      data: {
        orders: ordersWithMeta,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching orders by user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Delete order by admin/super admin
router.delete('/admin/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userRole = req.user.role?.name;

    // Check if user is admin or super admin
    if (!['admin', 'super admin'].includes(userRole?.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Delete the order
    await Order.findByIdAndDelete(orderId);

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error.message
    });
  }
});

// Get order statistics
router.get('/stats/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const userRole = req.user.role?.name;

    let matchQuery = {};
    if (userRole === 'publisher') {
      matchQuery = { publisherId: userId };
    } else if (userRole === 'advertiser') {
      matchQuery = { advertiserId: userId };
    }

    const stats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$price' }
        }
      }
    ]);

    const formattedStats = {
      requested: 0,
      inProgress: 0,
      advertiserApproval: 0,
      completed: 0,
      rejected: 0,
      totalRevenue: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      if (stat._id === 'completed') {
        formattedStats.totalRevenue = stat.totalRevenue;
      }
    });

    res.json({
      success: true,
      data: { stats: formattedStats }
    });

  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order statistics',
      error: error.message
    });
  }
});

// Get order statistics over time for admin dashboard chart
router.get('/admin/stats/trends', auth, async (req, res) => {
  try {
    const userRole = req.user.role?.name;
    
    // Check if user is admin or super admin
    if (!['admin', 'super admin'].includes(userRole?.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { period = '30d', startDate: startDateParam, endDate: endDateParam } = req.query;
    
    // Calculate date range based on period or use custom dates
    let endDate = new Date();
    let startDate = new Date();
    
    // If custom dates provided, use them; otherwise use period
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      // Set endDate to end of day
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }
    }

    // Get orders grouped by date and status
    const orderStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          stats: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Format the data for chart
    const formattedData = orderStats.map(item => {
      const statsObj = {
        date: item._id,
        requested: 0,
        inProgress: 0,
        advertiserApproval: 0,
        completed: 0,
        rejected: 0
      };

      item.stats.forEach(stat => {
        statsObj[stat.status] = stat.count;
      });

      return statsObj;
    });

    // Fill in missing dates with zeros
    const allDates = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      allDates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const finalData = allDates.map(date => {
      const existing = formattedData.find(d => d.date === date);
      if (existing) {
        return existing;
      }
      return {
        date,
        requested: 0,
        inProgress: 0,
        advertiserApproval: 0,
        completed: 0,
        rejected: 0
      };
    });

    res.json({
      success: true,
      data: finalData,
      period
    });

  } catch (error) {
    console.error('Error fetching order stats trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order statistics trends',
      error: error.message
    });
  }
});

// Get order statistics over time for publisher dashboard chart
router.get('/publisher/stats/trends', auth, async (req, res) => {
  try {
    const userRole = req.user.role?.name;
    const userId = req.user._id;
    
    // Check if user is publisher
    if (userRole?.toLowerCase() !== 'publisher') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Publisher privileges required.'
      });
    }

    const { period = '30d', startDate: startDateParam, endDate: endDateParam } = req.query;
    
    // Calculate date range based on period or use custom dates
    let endDate = new Date();
    let startDate = new Date();
    
    // If custom dates provided, use them; otherwise use period
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      // Set endDate to end of day
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }
    }

    // Get orders grouped by date and status for this publisher
    const orderStats = await Order.aggregate([
      {
        $match: {
          publisherId: userId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          stats: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Format the data for chart
    const formattedData = orderStats.map(item => {
      const statsObj = {
        date: item._id,
        requested: 0,
        inProgress: 0,
        advertiserApproval: 0,
        completed: 0,
        rejected: 0
      };

      item.stats.forEach(stat => {
        statsObj[stat.status] = stat.count;
      });

      return statsObj;
    });

    // Fill in missing dates with zeros
    const allDates = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      allDates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const finalData = allDates.map(date => {
      const existing = formattedData.find(d => d.date === date);
      if (existing) {
        return existing;
      }
      return {
        date,
        requested: 0,
        inProgress: 0,
        advertiserApproval: 0,
        completed: 0,
        rejected: 0
      };
    });

    res.json({
      success: true,
      data: finalData,
      period
    });

  } catch (error) {
    console.error('Error fetching publisher order stats trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order statistics trends',
      error: error.message
    });
  }
});

// Get order statistics over time for advertiser dashboard chart
router.get('/advertiser/stats/trends', auth, async (req, res) => {
  try {
    const userRole = req.user.role?.name;
    const userId = req.user._id;
    
    // Check if user is advertiser
    if (userRole?.toLowerCase() !== 'advertiser') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Advertiser privileges required.'
      });
    }

    const { period = '30d', startDate: startDateParam, endDate: endDateParam } = req.query;
    
    // Calculate date range based on period or use custom dates
    let endDate = new Date();
    let startDate = new Date();
    
    // If custom dates provided, use them; otherwise use period
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      // Set endDate to end of day
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }
    }

    // Get orders grouped by date and status for this advertiser
    const orderStats = await Order.aggregate([
      {
        $match: {
          advertiserId: userId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          stats: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Format the data for chart
    const formattedData = orderStats.map(item => {
      const statsObj = {
        date: item._id,
        requested: 0,
        inProgress: 0,
        advertiserApproval: 0,
        completed: 0,
        rejected: 0
      };

      item.stats.forEach(stat => {
        statsObj[stat.status] = stat.count;
      });

      return statsObj;
    });

    // Fill in missing dates with zeros
    const allDates = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      allDates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const finalData = allDates.map(date => {
      const existing = formattedData.find(d => d.date === date);
      if (existing) {
        return existing;
      }
      return {
        date,
        requested: 0,
        inProgress: 0,
        advertiserApproval: 0,
        completed: 0,
        rejected: 0
      };
    });

    res.json({
      success: true,
      data: finalData,
      period
    });

  } catch (error) {
    console.error('Error fetching advertiser order stats trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order statistics trends',
      error: error.message
    });
  }
});

// Get earnings trends over time for publisher dashboard chart
router.get('/publisher/earnings/trends', auth, async (req, res) => {
  try {
    const userRole = req.user.role?.name;
    const userId = req.user._id;
    
    // Check if user is publisher
    if (userRole?.toLowerCase() !== 'publisher') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Publisher privileges required.'
      });
    }

    const { period = '30d', startDate: startDateParam, endDate: endDateParam } = req.query;
    
    // Calculate date range based on period or use custom dates
    let endDate = new Date();
    let startDate = new Date();
    
    // If custom dates provided, use them; otherwise use period
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      // Set endDate to end of day
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }
    }

    // Get completed orders grouped by date and sum earnings
    const earningsStats = await Order.aggregate([
      {
        $match: {
          publisherId: userId,
          status: 'completed',
          completedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$completedAt' }
            }
          },
          earnings: { $sum: '$price' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Format the data for chart
    const formattedData = earningsStats.map(item => ({
      date: item._id.date,
      earnings: item.earnings,
      count: item.count
    }));

    // Fill in missing dates with zeros
    const allDates = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      allDates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const finalData = allDates.map(date => {
      const existing = formattedData.find(d => d.date === date);
      if (existing) {
        return existing;
      }
      return {
        date,
        earnings: 0,
        count: 0
      };
    });

    // Calculate total earnings
    const totalEarnings = finalData.reduce((sum, item) => sum + item.earnings, 0);
    const totalCount = finalData.reduce((sum, item) => sum + item.count, 0);

    res.json({
      success: true,
      data: finalData,
      period,
      totalEarnings,
      totalCount
    });

  } catch (error) {
    console.error('Error fetching publisher earnings trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings trends',
      error: error.message
    });
  }
});

module.exports = router;
