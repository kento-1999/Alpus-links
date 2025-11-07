"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  User,
  Calendar,
  DollarSign,
  Globe,
  FileText,
  Eye,
  Filter,
  Search
} from 'lucide-react'
import { apiService } from '@/lib/api'
import toast from 'react-hot-toast'

// Types
interface Order {
  _id: string
  publisherId: {
    _id: string
    firstName: string
    lastName: string
    email: string
  }
  websiteId: {
    _id: string
    domain: string
    url: string
  }
  postId?: {
    _id: string
    title: string
    content?: string
  }
  linkInsertionId?: {
    _id: string
    anchorText: string
    anchorUrl: string
  }
  type: 'guestPost' | 'linkInsertion' | 'writingGuestPost'
  status: 'requested' | 'inProgress' | 'advertiserApproval' | 'completed' | 'rejected'
  price: number
  requirements?: {
    minWordCount?: number
    maxLinks?: number
    allowedTopics?: string[]
    prohibitedTopics?: string[]
    deadline?: string
  }
  notes?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  rejectionReason?: string
  timeline?: Array<{
    status: string
    timestamp: string
    note?: string
    updatedBy?: string
  }>
}

interface TabData {
  id: string
  label: string
  count: number
  icon: any
  color: string
}

export default function AdvertiserOrdersPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('all')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  // Cache titles for Writing + GP posts by normalized domain
  const [writingGpTitleByDomain, setWritingGpTitleByDomain] = useState<Record<string, string>>({})
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [orderToReject, setOrderToReject] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // Tab configuration
  const tabs: TabData[] = [
    { id: 'all', label: 'All Orders', count: 0, icon: ClipboardList, color: 'blue' },
    { id: 'requested', label: 'Requested', count: 0, icon: AlertCircle, color: 'yellow' },
    { id: 'inProgress', label: 'In Progress', count: 0, icon: Clock, color: 'blue' },
    { id: 'advertiserApproval', label: 'Pending Approval', count: 0, icon: User, color: 'purple' },
    { id: 'completed', label: 'Completed', count: 0, icon: CheckCircle, color: 'green' },
    { id: 'rejected', label: 'Rejected', count: 0, icon: XCircle, color: 'red' }
  ]

  const [stats, setStats] = useState<{ total: number; stats: Array<{ status: string; count: number }>}>({ total: 0, stats: [] })

  // Fetch orders from API
  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiService.getAdvertiserOrders({
        status: activeTab === 'all' ? undefined : activeTab
      })
      
      if ((response.data as any)?.success) {
        setOrders((response.data as any).data.orders || [])
      } else {
        throw new Error((response.data as any)?.message || 'Failed to fetch orders')
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }

  // Fetch global stats for counts
  const fetchCounts = async () => {
    try {
      const userId = (user as any)?.id || (user as any)?._id
      if (!userId) return
      const response = await apiService.getOrderStats(userId)
      if ((response.data as any)?.success) {
        const data = (response.data as any).data || {}
        const raw = data.stats
        if (Array.isArray(raw)) {
          setStats({ total: typeof data.total === 'number' ? data.total : (raw.reduce((a: number, s: any) => a + (s?.count || 0), 0)), stats: raw })
        } else if (raw && typeof raw === 'object') {
          const orderedKeys = ['requested','inProgress','advertiserApproval','completed','rejected']
          const arr = orderedKeys.map(k => ({ status: k, count: Number((raw as any)[k] || 0) }))
          const total = arr.reduce((a, s) => a + s.count, 0)
          setStats({ total, stats: arr })
        } else {
          setStats({ total: 0, stats: [] })
        }
      }
    } catch (err) {
      console.error('Error fetching order stats:', err)
    }
  }

  // Normalize a domain or URL to hostname without www
  const normalizeDomain = (d: string) => {
    if (!d) return ''
    try {
      const u = new URL(d.startsWith('http') ? d : `https://${d}`)
      return u.hostname.replace('www.', '').toLowerCase()
    } catch {
      return d.replace('www.', '').toLowerCase()
    }
  }

  // Fetch Writing + GP posts once and build a map domain -> preferred title
  useEffect(() => {
    const loadWritingGpTitles = async () => {
      try {
        const postsResp = await apiService.getPosts()
        const allPosts = (postsResp as any)?.data?.posts || []
        // Filter to writing-gp-like posts
        const candidates = allPosts.filter((p: any) => p && (p.postType === 'writing-gp' || (!p.postType && (!p.anchorPairs || p.anchorPairs.length === 0))))
        // Prefer pending/inProgress per domain
        const score = (s: string) => (s === 'pending' ? 2 : s === 'inProgress' ? 1 : 0)
        const byDomain: Record<string, any[]> = {}
        candidates.forEach((p: any) => {
          const d = normalizeDomain(p.domain || p.completeUrl || '')
          if (!d) return
          if (!byDomain[d]) byDomain[d] = []
          byDomain[d].push(p)
        })
        const titleMap: Record<string, string> = {}
        Object.keys(byDomain).forEach(d => {
          const arr = byDomain[d].sort((a, b) => score(b.status) - score(a.status))
          const chosen = arr[0]
          if (chosen?.title) titleMap[d] = chosen.title
        })
        setWritingGpTitleByDomain(titleMap)
      } catch (e) {
        // Silent fail; UI will gracefully fallback
        console.warn('Failed to load Writing + GP titles:', e)
      }
    }
    loadWritingGpTitles()
  }, [])

  // Update tab counts using stats
  const updateTabCounts = () => {
    const byStatus: Record<string, number> = {}
    const statArray = Array.isArray(stats.stats) ? stats.stats : []
    statArray.forEach((s: any) => { if (s && s.status) byStatus[s.status] = s.count || 0 })
    return tabs.map(tab => tab.id === 'all' ? { ...tab, count: stats.total || 0 } : { ...tab, count: byStatus[tab.id] || 0 })
  }

  // Filter orders based on active tab and search
  const filteredOrders = orders.filter(order => {
    const matchesTab = activeTab === 'all' || order.status === activeTab
    const matchesSearch = searchTerm === '' ||
      order.publisherId.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.publisherId.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.publisherId.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.websiteId.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.postId?.title && order.postId.title.toLowerCase().includes(searchTerm.toLowerCase()))
    
    return matchesTab && matchesSearch
  })

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'inProgress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'advertiserApproval': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  // Get type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'guestPost': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'linkInsertion': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'writingGuestPost': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Handle order approval/rejection
  const handleOrderAction = async (orderId: string, action: 'approve' | 'reject', rejectionReason?: string) => {
    try {
      const newStatus = action === 'approve' ? 'completed' : 'rejected'
      const note = action === 'approve' ? 'Order approved by advertiser' : 'Order rejected by advertiser'
      
      const response = await apiService.updateOrderStatus(orderId, newStatus, note, rejectionReason)
      
      if ((response.data as any)?.success) {
        toast.success(`Order ${action === 'approve' ? 'approved' : 'rejected'} successfully`)
        fetchOrders()
        fetchCounts()
        // Close modal if it was open
        if (action === 'reject') {
          setShowRejectModal(false)
          setOrderToReject(null)
          setRejectionReason('')
        }
      } else {
        throw new Error((response.data as any)?.message || 'Failed to update order status')
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update order status')
    }
  }

  // Open reject modal
  const openRejectModal = (orderId: string) => {
    setOrderToReject(orderId)
    setShowRejectModal(true)
    setRejectionReason('')
  }

  // Close reject modal
  const closeRejectModal = () => {
    setShowRejectModal(false)
    setOrderToReject(null)
    setRejectionReason('')
  }

  // Confirm reject order
  const confirmRejectOrder = () => {
    if (orderToReject) {
      if (!rejectionReason.trim()) {
        toast.error('Please provide a reason for rejection')
        return
      }
      handleOrderAction(orderToReject, 'reject', rejectionReason)
    }
  }

  // Handle view details - navigate to appropriate edit page
  const handleViewDetails = async (order: Order) => {
    const viewOnlyParam = '?viewOnly=true'
    
    // For link insertion orders, the backend now populates postId for link insertion orders
    // since linkInsertionId contains the Post ID
    if (order.type === 'linkInsertion') {
      let targetId: string | null = null
      
      // Try postId first (backend should populate this now)
      if (order.postId?._id) {
        targetId = order.postId._id
      } 
      // Fallback to linkInsertionId if postId is not available
      else if (order.linkInsertionId) {
        if (typeof order.linkInsertionId === 'object' && (order.linkInsertionId as any)._id) {
          targetId = (order.linkInsertionId as any)._id
        } else if (typeof order.linkInsertionId === 'string') {
          targetId = order.linkInsertionId
        }
      }
      
      if (targetId) {
        router.push(`/advertiser/project/link-insertion/edit/${targetId}${viewOnlyParam}`)
      } else {
        console.error('Link insertion order missing ID:', order)
        toast.error('No link insertion found to view')
      }
    } else if (order.type === 'writingGuestPost') {
      // Primary: use populated postId
      if (order.postId?._id) {
        const base = typeof window !== 'undefined' ? window.location.origin : ''
        router.push(`${base}/advertiser/project/writing-gp/edit/${order.postId._id}${viewOnlyParam}`)
        return
      }

      // Fallback: fetch order details to try to get postId
      try {
        const response = await apiService.get(`/orders/${order._id}`) as any
        const fetched = response?.data?.data?.order
        const fetchedPostId = fetched?.postId?._id
        if (fetchedPostId) {
          const base = typeof window !== 'undefined' ? window.location.origin : ''
          router.push(`${base}/advertiser/project/writing-gp/edit/${fetchedPostId}${viewOnlyParam}`)
          return
        }
        // Secondary fallback: attempt to locate a Writing + GP post by domain
        try {
          const postsResp = await apiService.getPosts()
          const allPosts = (postsResp as any)?.data?.posts || []
          const targetDomain = order.websiteId?.domain || ''
          const normalize = (d: string) => {
            if (!d) return ''
            try {
              const u = new URL(d.startsWith('http') ? d : `https://${d}`)
              return u.hostname.replace('www.', '').toLowerCase()
            } catch {
              return d.replace('www.', '').toLowerCase()
            }
          }
          const matchDomain = normalize(targetDomain)
          const candidates = allPosts.filter((p: any) => {
            const typeOk = p.postType === 'writing-gp' || (!p.postType && (!p.anchorPairs || p.anchorPairs.length === 0))
            if (!typeOk) return false
            const pDomain = normalize(p.domain || p.completeUrl || '')
            return pDomain && matchDomain && pDomain === matchDomain
          })
          // Prefer pending/inProgress, then any
          const prioritized = candidates.sort((a: any, b: any) => {
            const score = (s: string) => (s === 'pending' ? 2 : s === 'inProgress' ? 1 : 0)
            return score(b.status) - score(a.status)
          })
          const chosen = prioritized[0]
          if (chosen?._id) {
            const base = typeof window !== 'undefined' ? window.location.origin : ''
            router.push(`${base}/advertiser/project/writing-gp/edit/${chosen._id}${viewOnlyParam}`)
            return
          }
          toast.error('No Writing + GP post found to view')
        } catch (e2) {
          console.error('Failed to locate Writing + GP post by domain:', e2)
          toast.error('No Writing + GP post found to view')
        }
      } catch (e) {
        console.error('Failed to fetch order details for Writing + GP:', e)
        toast.error('Unable to load Writing + GP details')
      }
    } else if (order.type === 'guestPost' && order.postId) {
      router.push(`/advertiser/project/post/edit/${order.postId._id}${viewOnlyParam}`)
    } else {
      toast.error('Unable to view details for this order type')
    }
  }

  // Fetch orders on component mount and when dependencies change
  useEffect(() => {
    fetchOrders()
  }, [activeTab])

  useEffect(() => {
    fetchCounts()
  }, [user?.id])

  // Also refresh counts when switching tabs (to reflect potential changes elsewhere)
  useEffect(() => {
    fetchCounts()
  }, [activeTab])

  const tabCounts = updateTabCounts()

  return (
    <ProtectedRoute allowedRoles={["advertiser"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-6">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  My Orders
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Track and manage your placed orders
                </p>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Responsive Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700">
              {/* Desktop Layout with Scrollable Tabs */}
              <nav className="hidden md:block" aria-label="Tabs">
                <div className="overflow-x-auto px-6">
                  <div className="flex min-w-max">
                    {tabCounts.map((tab) => {
                      const Icon = tab.icon
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center space-x-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.id
                              ? `border-${tab.color}-500 text-${tab.color}-600 dark:text-${tab.color}-400`
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                          <span className={`ml-2 py-0.5 px-2 rounded-full text-xs font-medium ${
                            activeTab === tab.id
                              ? `bg-${tab.color}-100 text-${tab.color}-800 dark:bg-${tab.color}-900/30 dark:text-${tab.color}-300`
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {tab.count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </nav>

              {/* Mobile Layout */}
              <div className="md:hidden">
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-medium bg-transparent border-0 focus:ring-0 dark:text-white"
                >
                  {tabCounts.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label} ({tab.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading orders...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error loading orders</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
                <button
                  onClick={fetchOrders}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No orders found</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {searchTerm 
                    ? 'No orders match your search criteria. Try adjusting your search terms.' 
                    : activeTab === 'all'
                      ? 'You haven\'t placed any orders yet. Start by adding items to your cart and placing an order.'
                      : `No orders found in "${tabs.find(t => t.id === activeTab)?.label}" status.`
                  }
                </p>
                {!searchTerm && activeTab === 'all' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Getting Started:</strong> Browse available websites and add services to your cart to place orders.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredOrders.map((order) => (
                  <div key={order._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300 group">
                    <div className="p-8">
                      {/* Order Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                        <div className="flex flex-wrap items-center gap-3 mb-4 sm:mb-0">
                          <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                            {order.status.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </span>
                          <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${getTypeColor(order.type)}`}>
                            {order.type === 'guestPost' ? 'Guest Post' : 
                             order.type === 'linkInsertion' ? 'Link Insertion' : 
                             'Writing + GP'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">Created {formatDate(order.createdAt)}</span>
                        </div>
                      </div>

                      {/* Main Content Grid */}
                      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 mb-8">
                        {/* Publisher Info */}
                        <div className="xl:col-span-1">
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 h-full">
                            <div className="flex items-center space-x-2 mb-3">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Publisher</h4>
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                {order.publisherId.firstName} {order.publisherId.lastName}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Website Info */}
                        <div className="xl:col-span-1">
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 h-full">
                            <div className="flex items-center space-x-2 mb-3">
                              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <Globe className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </div>
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Website</h4>
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                {order.websiteId.domain}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 break-all">
                                {order.websiteId.url}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Content Info */}
                        <div className="xl:col-span-1">
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 h-full">
                            <div className="flex items-center space-x-2 mb-3">
                              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                {order.type === 'linkInsertion' ? 'Link' : 
                                 order.type === 'writingGuestPost' ? 'Writing + GP' : 
                                 'Post'}
                              </h4>
                            </div>
                            <div className="space-y-1">
                              {order.type === 'writingGuestPost' ? (
                                order.postId?.title ? (
                                  <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2">
                                    {order.postId.title}
                                  </p>
                                ) : (
                                  (() => {
                                    const title = writingGpTitleByDomain[normalizeDomain(order.websiteId?.domain || '')]
                                    return title ? (
                                      <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2">{title}</p>
                                    ) : (
                                      <p className="text-sm text-gray-500 dark:text-gray-500 italic">No content assigned</p>
                                    )
                                  })()
                                )
                              ) : order.postId ? (
                                <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2">
                                  {order.postId.title}
                                </p>
                              ) : order.linkInsertionId ? (
                                <>
                                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                    {order.linkInsertionId.anchorText}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-500 break-all">
                                    {order.linkInsertionId.anchorUrl}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-500 italic">No content assigned</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Price & Actions */}
                        <div className="xl:col-span-1">
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 h-full">
                            <div className="flex items-center space-x-2 mb-3">
                              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Price</h4>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                  ${order.price.toFixed(2)}
                                </span>
                                {order.completedAt && (
                                  <div className="text-xs text-gray-500 dark:text-gray-500 text-right">
                                    <div className="font-medium">Completed</div>
                                    <div>{formatDate(order.completedAt)}</div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Approve Button */}
                              {order.status === 'advertiserApproval' && (
                                <div className="flex flex-col space-y-2">
                                  <button
                                    onClick={() => handleOrderAction(order._id, 'approve')}
                                    className="w-full px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 shadow-sm"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Approve Order</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Rejection Reason */}
                      {order.status === 'rejected' && order.rejectionReason && (
                        <div className="mb-6">
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <div className="flex items-start space-x-2">
                              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <h5 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Rejection Reason</h5>
                                <p className="text-sm text-red-700 dark:text-red-400">{order.rejectionReason}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Bottom Actions Bar */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-4">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-medium">Order ID:</span> {order._id.slice(-8)}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewDetails(order)}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center space-x-2 text-sm font-medium"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View Details</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Reject Order Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Reject Order
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Please provide a reason for rejection
                  </p>
                </div>
              </div>

              {/* Modal Content */}
              <div className="mb-6">
                <label htmlFor="rejectionReason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter the reason for rejecting this order..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                />
                {rejectionReason.trim().length === 0 && (
                  <p className="mt-1 text-xs text-red-500">
                    A rejection reason is required
                  </p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex space-x-3">
                <button
                  onClick={closeRejectModal}
                  className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRejectOrder}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600 flex items-center justify-center space-x-2"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}