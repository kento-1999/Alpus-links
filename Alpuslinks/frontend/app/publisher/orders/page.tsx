"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useState, useEffect } from 'react'
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
  Edit,
  Trash2,
  Filter,
  Search,
  MoreVertical
} from 'lucide-react'
import { apiService } from '@/lib/api'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

// Types
interface Task {
  _id: string
  advertiserId: {
    _id: string
    firstName: string
    lastName: string
    email: string
    company?: string
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
}

interface TabData {
  id: string
  label: string
  count: number
  icon: any
  color: string
}

export default function PublisherTaskManagementPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('requested')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [orderToReject, setOrderToReject] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  
  // Handle view details - navigate to order details page
  const handleViewDetails = (task: Task) => {
    router.push(`/publisher/orders/${task._id}`)
  }

  // Tab configuration
  const tabs: TabData[] = [
    { id: 'all', label: 'All', count: 0, icon: ClipboardList, color: 'blue' },
    { id: 'requested', label: 'Request for Advertiser', count: 0, icon: AlertCircle, color: 'yellow' },
    { id: 'inProgress', label: 'In Progress', count: 0, icon: Clock, color: 'blue' },
    { id: 'completed', label: 'Completed', count: 0, icon: CheckCircle, color: 'green' },
    { id: 'rejected', label: 'Rejected', count: 0, icon: XCircle, color: 'red' }
  ]

  const [stats, setStats] = useState<{ total: number; stats: Array<{ status: string; count: number }>}>({ total: 0, stats: [] })

  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiService.getPublisherOrders({
        status: activeTab === 'all' ? undefined : activeTab,
        search: searchTerm
      })
      
      if ((response.data as any)?.success) {
        setTasks((response.data as any).data.orders || [])
      } else {
        throw new Error((response.data as any)?.message || 'Failed to fetch orders')
      }
    } catch (err) {
      console.error('Error fetching tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
    } finally {
      setLoading(false)
    }
  }

  // Handle order status update
  const handleOrderStatusUpdate = async (orderId: string, newStatus: string, note?: string, rejectionReason?: string) => {
    try {
      const response = await apiService.updateOrderStatus(orderId, newStatus, note, rejectionReason)
      
      if ((response.data as any)?.success) {
        toast.success(`Order ${newStatus === 'inProgress' ? 'accepted' : newStatus === 'rejected' ? 'rejected' : 'updated'} successfully`)
        // Refresh the tasks list
        fetchTasks()
        fetchCounts()
      } else {
        throw new Error((response.data as any)?.message || 'Failed to update order status')
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update order status')
    }
  }

  // Handle accept order
  const handleAcceptOrder = (orderId: string) => {
    handleOrderStatusUpdate(orderId, 'inProgress', 'Order accepted and work started')
  }

  // Handle reject order
  const handleRejectOrder = (orderId: string, rejectionReason: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    handleOrderStatusUpdate(orderId, 'rejected', 'Order rejected', rejectionReason)
    setShowRejectModal(false)
    setOrderToReject(null)
    setRejectionReason('')
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
      handleRejectOrder(orderToReject, rejectionReason)
    }
  }

  // Fetch counts by fetching all publisher orders and counting by status
  const fetchCounts = async () => {
    try {
      // Fetch all orders for this publisher without status filter
      const response = await apiService.getPublisherOrders({
        status: undefined,
        page: 1,
        limit: 1000 // Get enough to count accurately
      })
      
      if ((response.data as any)?.success) {
        const allOrders = (response.data as any).data?.orders || []
        const pagination = (response.data as any).data?.pagination || {}
        
        // Count orders by status
        const countsByStatus: Record<string, number> = {
          requested: 0,
          inProgress: 0,
          completed: 0,
          rejected: 0
        }
        
        allOrders.forEach((order: any) => {
          const status = order.status
          if (status && countsByStatus.hasOwnProperty(status)) {
            countsByStatus[status]++
          }
        })
        
        // Use pagination total if available, otherwise use orders length
        const total = pagination.total ?? allOrders.length
        const statsArray = Object.entries(countsByStatus).map(([status, count]) => ({
          status,
          count
        }))
        
        setStats({ total, stats: statsArray })
      } else {
        setStats({ total: 0, stats: [] })
      }
    } catch (err) {
      console.error('Error fetching order counts:', err)
      setStats({ total: 0, stats: [] })
    }
  }

  // Update tab counts using stats
  const updateTabCounts = () => {
    const byStatus: Record<string, number> = {}
    const statArray = Array.isArray(stats.stats) ? stats.stats : []
    statArray.forEach((s: any) => { if (s && s.status) byStatus[s.status] = s.count || 0 })
    return tabs.map(tab => tab.id === 'all' ? { ...tab, count: stats.total || 0 } : { ...tab, count: byStatus[tab.id] || 0 })
  }

  // Filter tasks based on active tab and search
  const filteredTasks = tasks.filter(task => {
    const matchesTab = activeTab === 'all' || task.status === activeTab
    const matchesSearch = searchTerm === '' || 
      task.advertiserId.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.advertiserId.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.advertiserId.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.websiteId.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.postId?.title && task.postId.title.toLowerCase().includes(searchTerm.toLowerCase()))
    
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

  // Handle task actions
  const handleTaskAction = async (taskId: string, action: string) => {
    try {
      if (action === 'accept') {
        handleAcceptOrder(taskId)
      } else if (action === 'reject') {
        // Open reject modal
        openRejectModal(taskId)
      } else {
        console.log(`Performing ${action} on task ${taskId}`)
        toast.success(`Task ${action} successfully`)
        fetchTasks()
      }
    } catch (error) {
      console.error(`Error ${action} task:`, error)
      toast.error(`Failed to ${action} task`)
    }
  }

  // Fetch tasks on component mount and when dependencies change
  useEffect(() => {
    fetchTasks()
  }, [activeTab, searchTerm])

  useEffect(() => {
    fetchCounts()
  }, [user?.id])

  useEffect(() => {
    fetchCounts()
  }, [activeTab])

  const tabCounts = updateTabCounts()

  return (
    <ProtectedRoute allowedRoles={["publisher"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Task Management
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage advertiser orders and track progress
                </p>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search tasks by advertiser, website, or post..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </button>
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
                          className={`py-4 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                            activeTab === tab.id
                              ? (() => {
                                  switch (tab.color) {
                                    case 'blue': return 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    case 'yellow': return 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                                    case 'purple': return 'border-purple-500 text-purple-600 dark:text-purple-400'
                                    case 'green': return 'border-green-500 text-green-600 dark:text-green-400'
                                    case 'red': return 'border-red-500 text-red-600 dark:text-red-400'
                                    default: return 'border-gray-500 text-gray-600 dark:text-gray-400'
                                  }
                                })()
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm">{tab.label}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              activeTab === tab.id
                                ? (() => {
                                    switch (tab.color) {
                                      case 'blue': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                      case 'yellow': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                      case 'purple': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                      case 'green': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                      case 'red': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                                    }
                                  })()
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                            }`}>
                              {tab.count}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </nav>

              {/* Mobile Layout */}
              <nav className="md:hidden px-4 py-2" aria-label="Tabs">
                <div className="grid grid-cols-2 gap-2">
                  {tabCounts.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-3 px-3 rounded-lg font-medium text-sm transition-colors ${
                          activeTab === tab.id
                            ? (() => {
                                switch (tab.color) {
                                  case 'blue': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                  case 'yellow': return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                                  case 'purple': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                                  case 'green': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
                                  case 'red': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
                                  default: return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
                                }
                              })()
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <Icon className="w-4 h-4" />
                          <span className="truncate text-xs">{tab.label}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                            activeTab === tab.id
                              ? (() => {
                                  switch (tab.color) {
                                    case 'blue': return 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                                    case 'yellow': return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                                    case 'purple': return 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200'
                                    case 'green': return 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                                    case 'red': return 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                                    default: return 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                  }
                                })()
                              : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                          }`}>
                            {tab.count}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </nav>
            </div>
          </div>

          {/* Tasks List */}
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading tasks...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-20">
              <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tasks found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {searchTerm 
                  ? 'No tasks match your search criteria. Try adjusting your search terms.' 
                  : activeTab === 'all'
                    ? 'You don\'t have any tasks yet. Tasks will appear here when advertisers place orders for your websites.'
                    : `No tasks found in "${tabs.find(t => t.id === activeTab)?.label}" status.`
                }
              </p>
              {!searchTerm && activeTab === 'all' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Getting Started:</strong> Make sure your websites are published and available for advertisers to discover and place orders.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredTasks.map((task) => (
                <div key={task._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300 group">
                  <div className="p-8">
                    {/* Task Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                      <div className="flex flex-wrap items-center gap-3 mb-4 sm:mb-0">
                        <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(task.status)}`}>
                          {task.status.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                        <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${getTypeColor(task.type)}`}>
                          {task.type === 'guestPost' ? 'Guest Post' : 
                           task.type === 'linkInsertion' ? 'Link Insertion' : 
                           'Writing + GP'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span className="font-medium">Created {formatDate(task.createdAt)}</span>
                      </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 mb-8">
                      {/* Advertiser Info */}
                      <div className="xl:col-span-1">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 h-full">
                          <div className="flex items-center space-x-2 mb-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Advertiser</h4>
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">
                              {task.advertiserId.firstName} {task.advertiserId.lastName}
                            </p>
                            {task.advertiserId.company && (
                              <p className="text-xs text-gray-500 dark:text-gray-500 font-medium">
                                {task.advertiserId.company}
                              </p>
                            )}
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
                              {task.websiteId.domain}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 break-all">
                              {task.websiteId.url}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Post Info */}
                      <div className="xl:col-span-1">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 h-full">
                          <div className="flex items-center space-x-2 mb-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {task.type === 'linkInsertion' ? 'Link' : 'Post'}
                            </h4>
                          </div>
                          <div className="space-y-1">
                            {task.postId ? (
                              <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2">
                                {task.postId.title}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-500 italic">
                                {task.type === 'linkInsertion' ? 'No link insertion assigned' : 'No post assigned'}
                              </p>
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
                                ${task.price.toFixed(2)}
                              </span>
                              {task.completedAt && (
                                <div className="text-xs text-gray-500 dark:text-gray-500 text-right">
                                  <div className="font-medium">Completed</div>
                                  <div>{formatDate(task.completedAt)}</div>
                                </div>
                              )}
                            </div>
                            
                            {/* Accept/Reject Buttons */}
                            {task.status === 'requested' && (
                              <div className="flex flex-col space-y-2">
                                <button
                                  onClick={() => handleAcceptOrder(task._id)}
                                  className="w-full px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 shadow-sm"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Accept Order</span>
                                </button>
                                <button
                                  onClick={() => openRejectModal(task._id)}
                                  className="w-full px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 shadow-sm"
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>Reject Order</span>
                                </button>
                              </div>
                            )}

                            {/* Other Status Actions */}
                            {task.status === 'inProgress' && (
                              <button
                                onClick={() => handleOrderStatusUpdate(task._id, 'completed', 'Work completed')}
                                className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 shadow-sm"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span>Mark as Completed</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions Bar */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-medium">Order ID:</span> {task._id.slice(-8)}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {/* Hide view details button for requested status */}
                        {task.status !== 'requested' && (
                          <button
                            onClick={() => handleViewDetails(task)}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center space-x-2 text-sm font-medium"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View Details</span>
                          </button>
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