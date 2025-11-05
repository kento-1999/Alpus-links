"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { 
  Wallet, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { apiService } from '@/lib/api'
import toast from 'react-hot-toast'

interface BalanceData {
  balance: number
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

export default function AdvertiserBalancePage() {
  const { user } = useAuth()
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiService.getBalance()
      
      if ((response.data as any)?.success) {
        setBalanceData((response.data as any).data)
      } else {
        throw new Error((response.data as any)?.message || 'Failed to fetch balance')
      }
    } catch (err) {
      console.error('Error fetching balance:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch balance')
      toast.error(err instanceof Error ? err.message : 'Failed to fetch balance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()
  }, [])

  return (
    <ProtectedRoute allowedRoles={["advertiser"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-6">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  My Balance
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  View and manage your account balance
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading balance...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error loading balance</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
              <button
                onClick={fetchBalance}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
            </div>
          ) : balanceData ? (
            <div className="space-y-6">
              {/* Balance Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Current Balance
                      </h2>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-5xl font-bold text-gray-900 dark:text-white">
                          ${balanceData.balance.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                      <Wallet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={fetchBalance}
                      className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span className="text-sm font-medium">Refresh</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* How Balance Works */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      How Balance Works
                    </h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start space-x-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span>Balance is deducted when you place an order</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span>If an order is rejected, your balance is refunded</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span>Contact admin to add funds to your balance</span>
                    </li>
                  </ul>
                </div>

                {/* Balance Tips */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Tips
                    </h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start space-x-2">
                      <span className="text-purple-600 dark:text-purple-400 mt-1">•</span>
                      <span>Keep sufficient balance before placing orders</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-purple-600 dark:text-purple-400 mt-1">•</span>
                      <span>Check your balance regularly to avoid insufficient funds</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-purple-600 dark:text-purple-400 mt-1">•</span>
                      <span>Your balance updates automatically after order completion</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* User Info */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Account Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Name</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {balanceData.user.firstName} {balanceData.user.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {balanceData.user.email}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ProtectedRoute>
  )
}
