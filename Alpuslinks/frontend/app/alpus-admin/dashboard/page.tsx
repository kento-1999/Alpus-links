"use client"

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { UserLoginChart } from '@/components/charts/UserLoginChart'
import { OrderStatusChart } from '@/components/charts/OrderStatusChart'
import { apiService } from '@/lib/api'
import { Users, TrendingUp, UserPlus, Activity } from 'lucide-react'

interface LoginTrendData {
  date: string
  advertisers: number
  publishers: number
  total: number
}

interface LoginTrendsResponse {
  data: LoginTrendData[]
  period: string
  totalAdvertisers: number
  totalPublishers: number
  totalUsers: number
}

interface UserStatsResponse {
  overview: {
    total: number
    active: number
    inactive: number
    suspended: number
    recent: number
    weekly: number
    today: number
    todayLoggedIn: number
  }
  roles: Array<{
    _id: string
    count: number
  }>
  monthlyGrowth: Array<{
    _id: {
      year: number
      month: number
    }
    count: number
  }>
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

export default function AdminDashboardPage() {
  const [loginData, setLoginData] = useState<LoginTrendData[]>([])
  const [orderStatusData, setOrderStatusData] = useState<OrderStatusTrendData[]>([])
  const [loading, setLoading] = useState(true)
  const [orderLoading, setOrderLoading] = useState(true)
  const [summary, setSummary] = useState({
    totalAdvertisers: 0,
    totalPublishers: 0,
    totalUsers: 0
  })

  useEffect(() => {
    loadDashboardData('30d')
    loadOrderStatusData('30d')
  }, [])

  const loadDashboardData = async (period: string = '30d') => {
    try {
      setLoading(true)
      
      // Load user statistics (total registered users)
      const statsResponse = await apiService.getUserStats()
      const statsData = statsResponse.data as UserStatsResponse
      
      // Load login trends for the chart
      const trendsResponse = await apiService.getUserLoginTrends(period)
      const trendsData = trendsResponse.data as LoginTrendsResponse
      
      setLoginData(trendsData.data)
      
      // Extract user counts by role from stats
      const roleCounts = statsData.roles.reduce((acc: any, role: any) => {
        const roleName = role._id.toLowerCase()
        if (roleName.includes('advertiser')) {
          acc.advertisers = role.count
        } else if (roleName.includes('publisher')) {
          acc.publishers = role.count
        }
        return acc
      }, { advertisers: 0, publishers: 0 })
      
      setSummary({
        totalAdvertisers: roleCounts.advertisers,
        totalPublishers: roleCounts.publishers,
        totalUsers: statsData.overview.total
      })
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadOrderStatusData = async (period: '7d' | '30d' | '90d' = '30d') => {
    try {
      setOrderLoading(true)
      const response = await apiService.getOrderStatsTrends(period)
      const responseData = response.data as OrderStatusTrendsResponse
      setOrderStatusData(responseData.data || [])
    } catch (err) {
      console.error('Failed to load order status data:', err)
    } finally {
      setOrderLoading(false)
    }
  }

  const handleTimeRangeChange = (timeRange: '7d' | '30d' | '90d') => {
    loadDashboardData(timeRange)
  }

  const handleOrderTimeRangeChange = (timeRange: '7d' | '30d' | '90d') => {
    loadOrderStatusData(timeRange)
  }

  return (
    <ProtectedRoute allowedRoles={["super admin", "admin"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10">
        <div className="max-w-8xl mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor user activity and system performance</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Registered Users</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Registered Advertisers</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalAdvertisers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Registered Publishers</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalPublishers}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid - Equal width layout */}
          <div className="grid lg:grid-cols-2 gap-5 lg:gap-7.5 items-stretch mb-8">
            {/* User Login Chart - Takes 1/2 of full width */}
            <div className="lg:col-span-1">
              <UserLoginChart 
                data={loginData} 
                loading={loading} 
                onTimeRangeChange={handleTimeRangeChange}
              />
            </div>
            
            {/* Order Status Chart - Takes 1/2 of full width */}
            <div className="lg:col-span-1">
              <OrderStatusChart
                data={orderStatusData}
                loading={orderLoading}
                onTimeRangeChange={handleOrderTimeRangeChange}
              />
            </div>
          </div>

          {/* Additional Stats Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center mb-4">
                <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Logins today</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {loginData.length > 0 ? loginData[loginData.length - 1]?.total || 0 : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Advertiser logins</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {loginData.length > 0 ? loginData[loginData.length - 1]?.advertisers || 0 : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Publisher logins</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {loginData.length > 0 ? loginData[loginData.length - 1]?.publishers || 0 : 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <a 
                  href="/alpus-admin/users/all" 
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-lg transition-colors"
                >
                  Manage Users
                </a>
                <a 
                  href="/alpus-admin/websites" 
                  className="block w-full bg-green-600 hover:bg-green-700 text-white text-center py-2 px-4 rounded-lg transition-colors"
                >
                  Manage Websites
                </a>
                <a 
                  href="/alpus-admin/roles" 
                  className="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center py-2 px-4 rounded-lg transition-colors"
                >
                  Manage Roles
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}


