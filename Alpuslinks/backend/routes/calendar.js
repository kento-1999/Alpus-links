const express = require('express');
const router = express.Router();
const CalendarEvent = require('../models/CalendarEvent');
const auth = require('../middleware/auth');

// Get all calendar events (with optional date range filter)
router.get('/', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    
    let query = {};
    
    // If date range is provided, filter events
    if (start && end) {
      query = {
        $or: [
          // Events that start within the range
          { start: { $gte: new Date(start), $lte: new Date(end) } },
          // Events that end within the range
          { end: { $gte: new Date(start), $lte: new Date(end) } },
          // Events that span the entire range
          { 
            $and: [
              { start: { $lte: new Date(start) } },
              { end: { $gte: new Date(end) } }
            ]
          },
          // Events with no end date that start before or during the range
          {
            $and: [
              { end: { $exists: false } },
              { start: { $lte: new Date(end) } }
            ]
          }
        ]
      };
    }
    
    const events = await CalendarEvent.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .sort({ start: 1 });
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch calendar events',
      error: error.message
    });
  }
});

// Get a single calendar event by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Calendar event not found'
      });
    }
    
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Error fetching calendar event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch calendar event',
      error: error.message
    });
  }
});

// Create a new calendar event
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      start,
      end,
      allDay,
      backgroundColor,
      borderColor,
      textColor
    } = req.body;
    
    // Validate required fields
    if (!title || !start) {
      return res.status(400).json({
        success: false,
        message: 'Title and start date are required'
      });
    }
    
    // Validate end date if provided
    if (end && new Date(end) < new Date(start)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after or equal to start date'
      });
    }
    
    const eventData = {
      title,
      description: description || '',
      location: location || '',
      start: new Date(start),
      end: end ? new Date(end) : undefined,
      allDay: allDay || false,
      backgroundColor: backgroundColor || '#3b82f6',
      borderColor: borderColor || '#3b82f6',
      textColor: textColor || '#ffffff',
      createdBy: req.user.id,
      updatedBy: req.user.id
    };
    
    const event = new CalendarEvent(eventData);
    await event.save();
    
    const populatedEvent = await CalendarEvent.findById(event._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');
    
    res.status(201).json({
      success: true,
      message: 'Calendar event created successfully',
      data: populatedEvent
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create calendar event',
      error: error.message
    });
  }
});

// Update a calendar event
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      start,
      end,
      allDay,
      backgroundColor,
      borderColor,
      textColor
    } = req.body;
    
    const event = await CalendarEvent.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Calendar event not found'
      });
    }
    
    // Validate required fields if updating
    if (title !== undefined && !title) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be empty'
      });
    }
    
    // Validate end date if provided
    const startDate = start ? new Date(start) : event.start;
    if (end && new Date(end) < startDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after or equal to start date'
      });
    }
    
    // Update fields
    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;
    if (location !== undefined) event.location = location;
    if (start !== undefined) event.start = new Date(start);
    if (end !== undefined) event.end = end ? new Date(end) : undefined;
    if (allDay !== undefined) event.allDay = allDay;
    if (backgroundColor !== undefined) event.backgroundColor = backgroundColor;
    if (borderColor !== undefined) event.borderColor = borderColor;
    if (textColor !== undefined) event.textColor = textColor;
    event.updatedBy = req.user.id;
    
    await event.save();
    
    const populatedEvent = await CalendarEvent.findById(event._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');
    
    res.json({
      success: true,
      message: 'Calendar event updated successfully',
      data: populatedEvent
    });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update calendar event',
      error: error.message
    });
  }
});

// Delete a calendar event
router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Calendar event not found'
      });
    }
    
    await CalendarEvent.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Calendar event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete calendar event',
      error: error.message
    });
  }
});

module.exports = router;

