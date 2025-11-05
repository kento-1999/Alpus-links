"use client"
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { apiService } from '@/lib/api'
import { WebsiteTable } from './WebsiteTable'
import { WebsiteStats } from './WebsiteStats'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import CustomSelect from '@/components/ui/custom-select'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Website {
  _id: string
  publisherId: string
  domain: string
  url: string
  categories: Array<{
    _id: string
    name: string
    slug: string
  }>
  pricing: {
    guestPost?: number
    linkInsertion?: number
    writingGuestPost?: number
    extraLinks?: number
  }
  turnaroundTimeDays: number
  country: string
  language: string
  status: 'pending' | 'active' | 'rejected'
  ownershipVerification: {
    isVerified: boolean
    verifiedAt?: string
    verificationMethod?: string
    userRole: string
    verificationCode?: string
    verificationDetails?: {
      metaTagContent?: string
      fileName?: string
      dnsRecord?: string
    }
    lastAttempted?: string
    attemptCount: number
    status: string
    failureReason?: string
  }
  createdAt: string
  updatedAt: string
  meta?: {
    mozDA?: number
    ahrefsDR?: number
    semrushTraffic?: number
    googleAnalyticsTraffic?: number
    minWordCount?: number
    maxLinks?: number
    allowedTopics?: string[]
    prohibitedTopics?: string[]
    sponsored?: boolean
    email?: string
    phone?: string
    twitter?: string
    linkedin?: string
    facebook?: string
    notes?: string
  }
}

interface WebsiteStats {
  overview: {
    total: number
    active: number
    pending: number
    inactive: number
    rejected: number
    avgDomainAuthority: number
    avgMonthlyTraffic: number
  }
  categories: Array<{
    _id: string
    count: number
  }>
}

export function WebsiteManagement() {
  const { user } = useAuth()
  const router = useRouter()
  const [websites, setWebsites] = useState<Website[]>([])
  const [stats, setStats] = useState<WebsiteStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)
  const [categories, setCategories] = useState<Array<{_id: string, name: string, slug: string}>>([])
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    search: ''
  })

  const loadWebsites = async () => {
    if (!user?.id) {
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const response = await apiService.getWebsites(
        user.id,
        currentPage,
        pageSize,
        filters.status,
        filters.category,
        filters.search
      )

      if (response.data) {
        const data = response.data as any
        setWebsites(data.websites || [])
        setTotalPages(data.totalPages || 1)
        setTotalItems(data.total || 0)
      } else {
        setWebsites([])
        setTotalPages(1)
        setTotalItems(0)
      }
    } catch (err) {
      console.error('Error loading websites:', err)
      setError(err instanceof Error ? err.message : 'Failed to load websites')
      setWebsites([])
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    if (!user?.id) return

    try {
      const response = await apiService.getWebsiteStats(user.id)
      if (response.data) {
        setStats(response.data as WebsiteStats)
      }
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await apiService.getCategories()
      if (response.data && (response.data as any).success) {
        setCategories((response.data as any).data || [])
      }
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }

  useEffect(() => {
    loadWebsites()
  }, [user?.id, currentPage, pageSize, filters])

  useEffect(() => {
    loadStats()
  }, [user?.id])

  useEffect(() => {
    loadCategories()
  }, [])


  const handleDeleteWebsite = async (websiteId: string) => {
    try {
      await apiService.deleteWebsite(websiteId)
      setWebsites(prev => prev.filter(website => website._id !== websiteId))
      toast.success('Website deleted successfully!')
      setError(null) // Clear any previous errors
      loadStats() // Refresh stats
      
      // Dispatch event to update sidebar
      window.dispatchEvent(new CustomEvent('websiteDeleted'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete website')
    }
  }

  const handleEditWebsite = (website: Website) => {
    router.push(`/publisher/websites/edit/${website._id}`)
  }

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setCurrentPage(1) // Reset to first page when filters change
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1) // Reset to first page when page size changes
    // The useEffect will automatically reload data with new page size
  }

  if (loading && websites.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading websites...</p>
          <p className="mt-2 text-sm text-gray-500">User ID: {user?.id || 'Not available'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Website Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your websites for guest posting and link insertion services
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}



      {/* Stats Overview */}
      {stats && (
        <WebsiteStats stats={stats} />
      )}

      {/* Ultra Beautiful Action Bar */}
      <div className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-8 backdrop-blur-sm">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-center">
            {/* Search Section */}
            <div className="flex-1">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Search by name, domain, or description..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange({ search: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 bg-white/80 dark:bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-lg backdrop-blur-sm font-medium"
                />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Status Filter */}
            <div className="min-w-[160px]">
              <CustomSelect
                options={[
                  { value: '', label: 'All Status' },
                  { value: 'active', label: '✅ Active' },
                  { value: 'pending', label: '⏳ Pending' },
                  { value: 'inactive', label: '⏸️ Inactive' },
                  { value: 'rejected', label: '❌ Rejected' }
                ]}
                value={filters.status}
                onChange={(value) => handleFilterChange({ status: value })}
                placeholder="All Status"
              />
            </div>

            {/* Category Filter */}
            <div className="min-w-[180px]">
              <CustomSelect
                options={[
                  { value: '', label: 'All Categories' },
                  ...categories.map(category => ({
                    value: category.name,
                    label: `${category.name.charAt(0).toUpperCase() + category.name.slice(1)}`
                  }))
                ]}
                value={filters.category}
                onChange={(value) => handleFilterChange({ category: value })}
                placeholder="All Categories"
              />
            </div>

            {/* Add New Website Button */}
            <div className="flex items-center">
              <Button
                onClick={() => router.push('/publisher/websites/create')}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:shadow-xl active:scale-95 border-2 border-blue-500/20 hover:border-blue-400/40 backdrop-blur-sm whitespace-nowrap h-auto"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add New Website
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Website Table */}
      <WebsiteTable
        websites={websites}
        loading={loading}
        onEdit={handleEditWebsite}
        onDelete={handleDeleteWebsite}
      />
      
      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        pageSize={pageSize}
        onPageSizeChange={handlePageSizeChange}
        totalItems={totalItems}
        showPageSizeSelector={true}
        loading={loading}
      />

    </div>
  )
}
