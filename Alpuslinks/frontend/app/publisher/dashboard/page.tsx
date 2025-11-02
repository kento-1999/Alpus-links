"use client"
import { ProtectedRoute } from '@/components/auth/protected-route'
import Link from 'next/link'
import { BarChart3, Plus, Settings, Eye, Globe, Calendar } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { apiService } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { OrderStatusChart } from '@/components/charts/OrderStatusChart'

interface Website {
  _id: string
  url: string
  domain?: string
  status: 'active' | 'inactive' | 'pending' | 'rejected'
  createdAt: string
}

interface OrderStatusTrendData {
  date: string
  requested: number
  inProgress: number
  advertiserApproval: number
  completed: number
  rejected: number
}

interface OrderStatusTrendsResponse {
  data: OrderStatusTrendData[]
  period: string
}

export default function PublisherDashboardPage() {
  const [websites, setWebsites] = useState<Website[]>([])
  const [stats, setStats] = useState<any>(null)
  const [orderStatusData, setOrderStatusData] = useState<OrderStatusTrendData[]>([])
  const [loading, setLoading] = useState(true)
  const [orderLoading, setOrderLoading] = useState(true)
  const { user } = useAuth()
  const router = useRouter()

  const loadWebsites = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const response = await apiService.getWebsites(user.id, 1, 5) // Get first 5 websites
      if (response.data) {
        setWebsites((response.data as any).websites || [])
      }
    } catch (error) {
      console.error('Failed to load websites:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    if (!user?.id) return

    try {
      const response = await apiService.getWebsiteStats(user.id)
      if (response.data) {
        setStats(response.data as any)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const loadOrderStatusData = async (period: '7d' | '30d' | '90d' = '30d') => {
    try {
      setOrderLoading(true)
      const response = await apiService.getPublisherOrderStatsTrends(period)
      const responseData = response.data as OrderStatusTrendsResponse
      setOrderStatusData(responseData.data || [])
    } catch (err) {
      console.error('Failed to load order status data:', err)
    } finally {
      setOrderLoading(false)
    }
  }

  const handleOrderTimeRangeChange = (timeRange: '7d' | '30d' | '90d' | 'custom') => {
    if (timeRange !== 'custom') {
      loadOrderStatusData(timeRange)
    }
  }

  const handleCustomOrderDateChange = (startDate: string, endDate: string) => {
    loadOrderStatusDataWithCustomDates(startDate, endDate)
  }

  const loadOrderStatusDataWithCustomDates = async (startDate: string, endDate: string) => {
    try {
      setOrderLoading(true)
      const response = await apiService.getPublisherOrderStatsTrendsWithDates(startDate, endDate)
      const responseData = response.data as OrderStatusTrendsResponse
      setOrderStatusData(responseData.data || [])
    } catch (err) {
      console.error('Failed to load order status data:', err)
    } finally {
      setOrderLoading(false)
    }
  }

  useEffect(() => {
    loadWebsites()
    loadStats()
    loadOrderStatusData('30d')
  }, [user?.id])

  const handleAddWebsite = () => {
    router.push('/publisher/websites/create')
  }
  return (
    <ProtectedRoute allowedRoles={["publisher"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-8xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Publisher Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your websites and guest posting services
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Link
              href="/publisher/websites"
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    My Websites
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Manage your website listings
                  </p>
                </div>
              </div>
            </Link>

            <button
              onClick={handleAddWebsite}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow w-full text-left"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Plus className="w-8 h-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Add Website
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    List a new website
                  </p>
                </div>
              </div>
            </button>

            <Link
              href="/publisher/account"
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Settings className="w-8 h-8 text-purple-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Account Settings
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Manage your profile
                  </p>
                </div>
              </div>
            </Link>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Eye className="w-8 h-8 text-orange-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Analytics
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    View performance metrics
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Status Chart */}
          <div className="mb-8">
            <OrderStatusChart
              data={orderStatusData}
              loading={orderLoading}
              onTimeRangeChange={handleOrderTimeRangeChange}
              onCustomDateChange={handleCustomOrderDateChange}
            />
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Recent Activity
              </h2>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
              ) : websites.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Your Websites ({websites.length})
                    </h3>
                    <Link
                      href="/publisher/websites"
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View All
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {websites.map((website) => (
                      <div key={website._id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <Globe className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {website.domain || new URL(website.url).hostname.replace('www.', '')}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {website.url}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            website.status === 'active' ? 'bg-green-100 text-green-800' :
                            website.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {website.status}
                          </span>
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(website.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {stats && (
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{stats.overview?.total || 0}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{stats.overview?.active || 0}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Active</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{stats.overview?.pending || 0}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="text-2xl font-bold text-gray-600">{stats.overview?.inactive || 0}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Inactive</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No websites yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Start by adding your first website to see activity here.
                  </p>
                  <button
                    onClick={handleAddWebsite}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Website
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </ProtectedRoute>
  )
}


