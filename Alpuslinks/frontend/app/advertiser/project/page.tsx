"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle,
  Calendar,
  Tag,
  ExternalLink
} from 'lucide-react'
import { apiService } from '@/lib/api'
import toast from 'react-hot-toast'

interface Post {
  _id: string
  title: string
  slug: string
  domain: string
  completeUrl: string
  description: string
  metaTitle: string
  metaDescription: string
  keywords: string
  content: string
  status: 'draft' | 'pending' | 'inProgress' | 'approved' | 'rejected'
  postType: 'regular' | 'link-insertion' | 'writing-gp'
  createdAt: string
  updatedAt: string
  anchorPairs: Array<{
    text: string
    link: string
  }>
}

export default function PostManagementPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [postToDelete, setPostToDelete] = useState<Post | null>(null)
  const [requestedOrderPostIds, setRequestedOrderPostIds] = useState<Set<string>>(new Set())
  const [requestedOrderDomains, setRequestedOrderDomains] = useState<Set<string>>(new Set())
  const [orderStatusMap, setOrderStatusMap] = useState<Map<string, string>>(new Map())
  const [orderDomainStatusMap, setOrderDomainStatusMap] = useState<Map<string, string>>(new Map())

  // Helper function to extract domain from completeUrl
  const getDomainFromUrl = (url: string): string => {
    if (!url) return 'Not specified'
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      return urlObj.hostname.replace('www.', '')
    } catch (e) {
      return 'Invalid URL'
    }
  }

  // Fetch posts and orders
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Fetch posts and all orders (not just requested)
        const [postsRes, ordersRes] = await Promise.all([
          apiService.getPosts(),
          apiService.getAdvertiserOrders({})
        ])

        setPosts(postsRes.data?.posts || [])

        // Map orders to related content IDs and website domains with their statuses
        const orders = (ordersRes as any)?.data?.data?.orders || (ordersRes as any)?.data?.orders || []
        const postIds = new Set<string>()
        const domains = new Set<string>()
        const statusMap = new Map<string, string>()
        const domainStatusMap = new Map<string, string>()
        
        for (const order of orders) {
          const orderStatus = order.status || 'requested'
          
          // Track by postId
          if (order?.postId?._id) {
            const postId = order.postId._id
            postIds.add(postId)
            // Map post ID to order status (prioritize inProgress, requested, then others)
            if (!statusMap.has(postId) || orderStatus === 'inProgress') {
              statusMap.set(postId, orderStatus)
            } else if (statusMap.get(postId) !== 'inProgress' && orderStatus === 'requested') {
              statusMap.set(postId, orderStatus)
            }
          }
          
          // Track by linkInsertionId (which is actually a Post ID for link insertion orders)
          if (order?.linkInsertionId?._id) {
            const postId = order.linkInsertionId._id
            postIds.add(postId)
            if (!statusMap.has(postId) || orderStatus === 'inProgress') {
              statusMap.set(postId, orderStatus)
            } else if (statusMap.get(postId) !== 'inProgress' && orderStatus === 'requested') {
              statusMap.set(postId, orderStatus)
            }
          }
          
          // Track by domain for link-insertion and writing-gp orders
          const websiteDomain = order?.websiteId?.domain
          if (websiteDomain && (order.type === 'linkInsertion' || order.type === 'writingGuestPost')) {
            const domainKey = String(websiteDomain).toLowerCase()
            domains.add(domainKey)
            // Map domain to order status (prioritize inProgress, requested, then others)
            if (!domainStatusMap.has(domainKey) || orderStatus === 'inProgress') {
              domainStatusMap.set(domainKey, orderStatus)
            } else if (domainStatusMap.get(domainKey) !== 'inProgress' && orderStatus === 'requested') {
              domainStatusMap.set(domainKey, orderStatus)
            }
          }
        }
        
        setRequestedOrderPostIds(postIds)
        setRequestedOrderDomains(domains)
        setOrderStatusMap(statusMap)
        setOrderDomainStatusMap(domainStatusMap)
      } catch (error: any) {
        console.error('Failed to fetch posts or orders:', error)
        toast.error(error?.message || 'Failed to load posts')
        setPosts([])
        setRequestedOrderPostIds(new Set())
        setRequestedOrderDomains(new Set())
        setOrderStatusMap(new Map())
        setOrderDomainStatusMap(new Map())
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-blue-500" />
      case 'inProgress':
        return <Clock className="w-4 h-4 text-blue-600" />
      case 'request':
        return <Clock className="w-4 h-4 text-orange-500" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'draft':
        return <Edit className="w-4 h-4 text-gray-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'inProgress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'request':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  const filteredPosts = posts.filter(post => {
    const domain = post.domain || getDomainFromUrl(post.completeUrl)
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        domain.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'title':
        return a.title.localeCompare(b.title)
      default:
        return 0
    }
  })

  const handleCreatePost = () => {
    router.push('/advertiser/project/post/create')
  }

  const handleCreateLinkInsertion = () => {
    router.push('/advertiser/project/link-insertion/create')
  }

  const handleWritingGP = () => {
    router.push('/advertiser/project/writing-gp')
  }

  const getEditButtonText = (post: Post) => {
    // Handle posts that might not have postType set (fallback logic)
    if (!post.postType) {
      // Fallback to content-based detection for older posts
      if (post.title === 'Link Insertion Request' || 
          post.title.includes('Link Insertion') ||
          (post.anchorPairs && post.anchorPairs.length > 0 && 
           !post.title.includes('Writing') && 
           !post.title.includes('GP'))) {
        return 'Edit Link Insertion'
      } else if (post.title === 'Writing + GP' || 
                 post.title.includes('Writing') || 
                 post.title.includes('GP') ||
                 (post.title.length <= 3 && (!post.anchorPairs || post.anchorPairs.length === 0))) {
        return 'Edit Writing + GP'
      }
      return 'Edit Post'
    }
    
    switch (post.postType) {
      case 'link-insertion': return 'Edit Link Insertion'
      case 'writing-gp': return 'Edit Writing + GP'
      default: return 'Edit Post'
    }
  }

  const handleEditPost = (post: Post) => {
    // Handle posts that might not have postType set (fallback logic)
    if (!post.postType) {
      // Fallback to content-based detection for older posts
      if (post.title === 'Link Insertion Request' || 
          post.title.includes('Link Insertion') ||
          (post.anchorPairs && post.anchorPairs.length > 0 && 
           !post.title.includes('Writing') && 
           !post.title.includes('GP'))) {
        router.push(`/advertiser/project/link-insertion/edit/${post._id}`)
        return
      } else if (post.title === 'Writing + GP' || 
                 post.title.includes('Writing') || 
                 post.title.includes('GP') ||
                 (post.title.length <= 3 && (!post.anchorPairs || post.anchorPairs.length === 0))) {
        router.push(`/advertiser/project/writing-gp/edit/${post._id}`)
        return
      }
      router.push(`/advertiser/project/post/edit/${post._id}`)
      return
    }
    
    // Use the postType field to determine the correct edit route
    switch (post.postType) {
      case 'link-insertion':
        router.push(`/advertiser/project/link-insertion/edit/${post._id}`)
        break
      case 'writing-gp':
        router.push(`/advertiser/project/writing-gp/edit/${post._id}`)
        break
      default:
        router.push(`/advertiser/project/post/edit/${post._id}`)
        break
    }
  }


  const handleDeletePost = (post: Post) => {
    setPostToDelete(post)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (postToDelete) {
      try {
        await apiService.deletePost(postToDelete._id)
        setPosts(prev => prev.filter(post => post._id !== postToDelete._id))
        setShowDeleteModal(false)
        setPostToDelete(null)
        toast.success('Post deleted successfully')
      } catch (error: any) {
        console.error('Delete post error:', error)
        toast.error(error?.message || 'Failed to delete post')
      }
    }
  }

  const cancelDelete = () => {
    setShowDeleteModal(false)
    setPostToDelete(null)
  }

  return (
    <ProtectedRoute allowedRoles={["advertiser"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Project Management
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage your guest posts and content
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCreatePost}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                <span>Create New Post</span>
              </button>
              <button
                onClick={handleCreateLinkInsertion}
                className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                <span>Create Link Insertion</span>
              </button>
              <button
                onClick={handleWritingGP}
                className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                <span>Writing + GP</span>
              </button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="published">Published</option>
                </select>
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'title')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="title">Sort by Title</option>
                </select>
              </div>
            </div>
          </div>

          {/* Posts List */}
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading posts...</p>
            </div>
          ) : sortedPosts.length === 0 ? (
            <div className="text-center py-20">
              <div className="mx-auto w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
                <FileText className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No posts found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No posts match your current filters. Try adjusting your search criteria.'
                  : 'You haven\'t created any posts yet. Start by creating your first guest post.'
                }
              </p>
              <button
                onClick={handleCreatePost}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                <span>Create Your First Post</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPosts.map((post) => (
                <div key={post._id} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50 overflow-hidden hover:shadow-2xl transition-all duration-200">
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start space-x-4 flex-1 min-w-0">
                        {/* Post Icon */}
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shadow-md">
                            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>

                        {/* Post Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {post.title}
                          </h3>

                          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>Created {new Date(post.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <ExternalLink className="w-4 h-4" />
                              <span className="truncate">Domain: {post.domain || getDomainFromUrl(post.completeUrl)}</span>
                            </div>
                          </div>

                          {/* Description */}
                          {post.description && (
                            <div className="mb-3">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {post.description}
                              </p>
                            </div>
                          )}

                          {/* Meta Information */}
                          {(post.metaTitle || post.metaDescription || post.keywords) && (
                            <div className="space-y-2 mb-4">
                              {post.metaTitle && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Meta Title:</span> {post.metaTitle}
                                </p>
                              )}
                              {post.metaDescription && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Meta Description:</span> {post.metaDescription}
                                </p>
                              )}
                              {post.keywords && (
                                <div className="flex items-center space-x-2">
                                  <Tag className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Keywords:</span> {post.keywords}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Anchor Pairs */}
                          {post.anchorPairs && post.anchorPairs.length > 0 && (() => {
                            // Filter out invalid or duplicate anchor pairs
                            const validAnchorPairs = post.anchorPairs.filter((pair, index, self) => {
                              // Remove empty pairs
                              if (!pair.text?.trim() || !pair.link?.trim()) return false
                              
                              // Remove pairs with invalid URLs
                              if (!pair.link.startsWith('http')) return false
                              
                              // Remove duplicates based on text and link
                              const isDuplicate = self.findIndex(p => 
                                p.text?.trim() === pair.text?.trim() && 
                                p.link?.trim() === pair.link?.trim()
                              ) !== index
                              
                              return !isDuplicate
                            })
                            
                            return validAnchorPairs.length > 0 ? (
                              <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anchor Links:</p>
                                <div className="space-y-1">
                                  {validAnchorPairs.map((pair, index) => (
                                    <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                                      <span className="font-medium">"{pair.text}"</span> → 
                                      <span className="ml-1 text-blue-600 dark:text-blue-400">{pair.link}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null
                          })()}
                        </div>
                      </div>

                      {/* Status and Actions */}
                      <div className="flex items-center space-x-3 ml-4">
                        {(() => {
                          const domainForPost = (post.domain || getDomainFromUrl(post.completeUrl) || '').toLowerCase()
                          const isRequestedById = requestedOrderPostIds.has(post._id)
                          const isRequestedByDomain = (post.postType === 'link-insertion' || post.postType === 'writing-gp') && requestedOrderDomains.has(domainForPost)
                          
                          // Determine order status
                          let orderStatus: string | null = null
                          if (isRequestedById) {
                            orderStatus = orderStatusMap.get(post._id) || null
                          } else if (isRequestedByDomain) {
                            orderStatus = orderDomainStatusMap.get(domainForPost) || null
                          }
                          
                          // Map order status to display status
                          let displayStatus: 'draft' | 'pending' | 'inProgress' | 'approved' | 'rejected' | 'request' = post.status
                          if (orderStatus) {
                            // Map order statuses to post statuses
                            if (orderStatus === 'inProgress') {
                              displayStatus = 'inProgress'
                            } else if (orderStatus === 'requested') {
                              displayStatus = 'request'
                            } else if (orderStatus === 'advertiserApproval') {
                              displayStatus = 'pending'
                            } else if (orderStatus === 'completed') {
                              displayStatus = 'approved'
                            } else if (orderStatus === 'rejected') {
                              displayStatus = 'rejected'
                            }
                          }
                          
                          return (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(displayStatus)}`}>
                              {getStatusIcon(displayStatus)}
                              <span className="ml-1 capitalize">{displayStatus}</span>
                            </span>
                          )
                        })()}
                        {post.status !== 'inProgress' && (
                          <>
                            <button
                              onClick={() => handleEditPost(post)}
                              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title={getEditButtonText(post)}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {(() => {
                              const domainForPost = (post.domain || getDomainFromUrl(post.completeUrl) || '').toLowerCase()
                              const isRequestedById = requestedOrderPostIds.has(post._id)
                              const isRequestedByDomain = (post.postType === 'link-insertion' || post.postType === 'writing-gp') && requestedOrderDomains.has(domainForPost)
                              const displayStatus: string = (isRequestedById || isRequestedByDomain) ? 'request' : post.status
                              const hideDelete = displayStatus === 'request' || displayStatus === 'inProgress' || displayStatus === 'approved' || displayStatus === 'published' || displayStatus === 'completed'
                              if (hideDelete) return null
                              return (
                                <button
                                  onClick={() => handleDeletePost(post)}
                                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Delete Post"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && postToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Delete Post
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              {/* Modal Content */}
              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  Are you sure you want to delete this post?
                </p>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {postToDelete.title}
                  </h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p>Status: <span className="capitalize font-medium">{postToDelete.status}</span></p>
                    <p>Created: {new Date(postToDelete.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex space-x-3">
                <button
                  onClick={cancelDelete}
                  className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Post</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}
