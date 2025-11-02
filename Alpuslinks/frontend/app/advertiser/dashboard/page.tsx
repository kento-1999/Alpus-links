"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { OrderStatusChart } from '@/components/charts/OrderStatusChart'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { apiService } from '@/lib/api'

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

export default function AdvertiserDashboardPage() {
  const [orderStatusData, setOrderStatusData] = useState<OrderStatusTrendData[]>([])
  const [orderLoading, setOrderLoading] = useState(true)
  const { user } = useAuth()

  const loadOrderStatusData = async (period: '7d' | '30d' | '90d' = '30d') => {
    try {
      setOrderLoading(true)
      const response = await apiService.getAdvertiserOrderStatsTrends(period)
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
      const response = await apiService.getAdvertiserOrderStatsTrendsWithDates(startDate, endDate)
      const responseData = response.data as OrderStatusTrendsResponse
      setOrderStatusData(responseData.data || [])
    } catch (err) {
      console.error('Failed to load order status data:', err)
    } finally {
      setOrderLoading(false)
    }
  }

  useEffect(() => {
    loadOrderStatusData('30d')
  }, [user?.id])

  return (
    <ProtectedRoute allowedRoles={["advertiser"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-8xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Advertiser Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your orders and guest posting campaigns
            </p>
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
        </div>
      </div>
    </ProtectedRoute>
  )
}
