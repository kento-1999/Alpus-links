"use client"

import { useState, useEffect, useCallback } from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { apiService } from '@/lib/api'
import { Search, Filter, ShoppingCart, ExternalLink, Mail, Phone, Globe } from 'lucide-react'
import { useAppDispatch } from '@/hooks/redux'
import { addItem } from '@/store/slices/cartSlice'
import { useRouter } from 'next/navigation'
import CustomSelect from '@/components/ui/custom-select'

interface Website {
  _id: string
  url: string
  domain: string
  categories?: Array<{
    _id: string
    name: string
    slug: string
  }>
  domainAuthority?: number
  domainRating?: number
  monthlyTraffic?: number
  semrushTraffic?: number
  language: string
  country: string
  pricing: {
    guestPost?: number
    linkInsertion?: number
  }
  requirements?: {
    minWordCount?: number
    maxLinks?: number
    allowedTopics?: string[]
    prohibitedTopics?: string[]
  }
  contactInfo?: {
    email?: string
    phone?: string
  }
  socialMedia?: {
    twitter?: string
    linkedin?: string
    facebook?: string
  }
  publisherId: {
    _id: string
    firstName: string
    lastName: string
    email: string
  }
  createdAt: string
}

interface Filters {
  page: number
  limit: number
  category: string
  country: string
  language: string
  minDomainAuthority: number
  maxDomainAuthority: number
  minGuestPostPrice: number
  maxGuestPostPrice: number
  minLinkInsertionPrice: number
  maxLinkInsertionPrice: number
  search: string
  sortBy: string
  sortOrder: string
}

interface FilterOptions {
  categories: string[]
  countries: string[]
  languages: string[]
}

export default function AdvertiserWebsitesPage() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const [websites, setWebsites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    categories: [],
    countries: [],
    languages: []
  })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderType, setOrderType] = useState<'guestPost' | 'linkInsertion'>('guestPost')

  const [filters, setFilters] = useState<Filters>({
    page: 1,
    limit: 12,
    category: '',
    country: '',
    language: '',
    minDomainAuthority: 0,
    maxDomainAuthority: 100,
    minGuestPostPrice: 0,
    maxGuestPostPrice: 10000,
    minLinkInsertionPrice: 0,
    maxLinkInsertionPrice: 10000,
    search: '',
    sortBy: 'domainAuthority',
    sortOrder: 'desc'
  })

  const fetchWebsites = useCallback(async (currentFilters = filters) => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 Fetching websites with filters:', currentFilters)
      console.log('🌐 API Base URL:', apiService.getBaseURL())
      const response = await apiService.getAdvertiserWebsites(currentFilters)
      console.log('📡 API Response:', response)
      
      if (response.data) {
        const data = response.data as any
        console.log('📊 Response data:', data)
        setWebsites(data.websites || [])
        setTotalPages(data.totalPages || 1)
        setCurrentPage(data.currentPage || 1)
        setTotal(data.total || 0)
        
        if (data.filters) {
          setFilterOptions({
            categories: data.filters.categories || [],
            countries: data.filters.countries || [],
            languages: data.filters.languages || []
          })
        }
      }
    } catch (err) {
      console.error('❌ Error fetching websites:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch websites')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWebsites(filters)
  }, [
    filters.page,
    filters.limit,
    filters.category,
    filters.country,
    filters.language,
    filters.minDomainAuthority,
    filters.maxDomainAuthority,
    filters.minGuestPostPrice,
    filters.maxGuestPostPrice,
    filters.minLinkInsertionPrice,
    filters.maxLinkInsertionPrice,
    filters.search,
    filters.sortBy,
    filters.sortOrder
  ])

  const handleFilterChange = (newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }))
  }

  const handleSearch = (searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm, page: 1 }))
  }

  const handleOrderClick = (website: Website, type: 'guestPost' | 'linkInsertion') => {
    // Add to cart and go to cart
    const priceRaw = type === 'guestPost' ? website.pricing?.guestPost : website.pricing?.linkInsertion
    const price = Number(priceRaw ?? 0)
    dispatch(addItem({
      websiteId: website._id,
      domain: website.domain || new URL(website.url).hostname.replace('www.', ''),
      type,
      price,
    }))
    router.push('/advertiser/cart')
  }

  const handleOrderSubmit = async (orderData: any) => {
    try {
      // Here you would implement the order submission logic
      console.log('Order submitted:', orderData)
      setShowOrderModal(false)
      setSelectedWebsite(null)
    } catch (err) {
      console.error('Error submitting order:', err)
    }
  }

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 12,
      category: '',
      country: '',
      language: '',
      minDomainAuthority: 0,
      maxDomainAuthority: 100,
      minGuestPostPrice: 0,
      maxGuestPostPrice: 10000,
      minLinkInsertionPrice: 0,
      maxLinkInsertionPrice: 10000,
      search: '',
      sortBy: 'domainAuthority',
      sortOrder: 'desc'
    })
  }

  const hasActiveFilters = filters.category || filters.country || filters.language || 
    filters.minDomainAuthority > 0 || filters.maxDomainAuthority < 100 ||
    filters.minGuestPostPrice > 0 || filters.maxGuestPostPrice < 10000 ||
    filters.minLinkInsertionPrice > 0 || filters.maxLinkInsertionPrice < 10000 ||
    filters.search

  return (
    <ProtectedRoute allowedRoles={["advertiser"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {loading && websites.length === 0 ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading websites...</p>
            </div>
          </div>
        ) : (
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Available Websites
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Browse and order guest posts and link insertions from approved websites
              </p>
            </div>

            {/* Search and Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search websites..."
                      value={filters.search}
                      onChange={(e) => handleSearch(e.target.value)}
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
                  {hasActiveFilters && (
                    <span className="ml-2 bg-blue-500 text-white text-xs rounded-full px-2 py-1">
                      Active
                    </span>
                  )}
                </button>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Category
                      </label>
                      <CustomSelect
                        value={filters.category}
                        onChange={(value) => handleFilterChange({ category: value })}
                        options={[
                          { value: '', label: 'All Categories' },
                          ...filterOptions.categories.map(cat => ({ value: cat, label: cat }))
                        ]}
                      />
                    </div>

                    {/* Country */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Country
                      </label>
                      <CustomSelect
                        value={filters.country}
                        onChange={(value) => handleFilterChange({ country: value })}
                        options={[
                          { value: '', label: 'All Countries' },
                          ...filterOptions.countries.map(country => ({ value: country, label: country }))
                        ]}
                      />
                    </div>

                    {/* Language */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Language
                      </label>
                      <CustomSelect
                        value={filters.language}
                        onChange={(value) => handleFilterChange({ language: value })}
                        options={[
                          { value: '', label: 'All Languages' },
                          ...filterOptions.languages.map(lang => ({ value: lang, label: lang }))
                        ]}
                      />
                    </div>

                    {/* Sort */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Sort By
                      </label>
                      <CustomSelect
                        value={`${filters.sortBy}-${filters.sortOrder}`}
                        onChange={(value) => {
                          const [sortBy, sortOrder] = value.split('-')
                          handleFilterChange({ sortBy, sortOrder })
                        }}
                        options={[
                          { value: 'domainAuthority-desc', label: 'Domain Authority (High to Low)' },
                          { value: 'domainAuthority-asc', label: 'Domain Authority (Low to High)' },
                          { value: 'guestPostPrice-asc', label: 'Guest Post Price (Low to High)' },
                          { value: 'guestPostPrice-desc', label: 'Guest Post Price (High to Low)' },
                          { value: 'linkInsertionPrice-asc', label: 'Link Insertion Price (Low to High)' },
                          { value: 'linkInsertionPrice-desc', label: 'Link Insertion Price (High to Low)' }
                        ]}
                      />
                    </div>
                  </div>

                  {/* Clear Filters */}
                  {hasActiveFilters && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={clearFilters}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Clear all filters
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Results */}
            <div className="mb-6">
              <div className="flex justify-between items-center">
                <p className="text-gray-600 dark:text-gray-400">
                  {total} websites found
                </p>
              </div>
            </div>

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            {/* Websites Table */}
            {websites.length === 0 ? (
              <div className="text-center py-12">
                <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No websites found</h3>
                <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters or search terms</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Website</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Categories</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Metrics</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Prices</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Requirements</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {websites.map((website) => (
                        <tr key={website._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900 dark:text-white">{website.domain || new URL(website.url).hostname.replace('www.', '')}</span>
                              <a href={website.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs inline-flex items-center mt-1">
                                {website.domain}
                                <ExternalLink className="w-3 h-3 ml-1" />
                              </a>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {website.categories && website.categories.length > 0 ? (
                                website.categories.map((cat, idx) => (
                                  <span key={idx} className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded capitalize">{cat.name}</span>
                                ))
                              ) : (
                                <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded">N/A</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                                <span className="text-gray-500 dark:text-gray-400">Moz DA:</span>
                                <span className="font-medium ml-1">{website.domainAuthority ?? 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="text-gray-500 dark:text-gray-400">Ahrefs DR:</span>
                                <span className="font-medium ml-1">{website.domainRating ?? 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full bg-purple-500"></span>
                                <span className="text-gray-500 dark:text-gray-400">Semrush:</span>
                                <span className="font-medium ml-1">{website.semrushTraffic ? website.semrushTraffic.toLocaleString() : 'N/A'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            <div className="flex flex-col">
                              <span>GP: {website.pricing?.guestPost ? `$${website.pricing.guestPost}` : 'N/A'}</span>
                              <span>LI: {website.pricing?.linkInsertion ? `$${website.pricing.linkInsertion}` : 'N/A'}</span>
                              <span>W+GP: {(website as any).pricing?.writingGuestPost ? `$${(website as any).pricing?.writingGuestPost}` : 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            <div className="flex flex-col space-y-1">
                              {(website as any).meta?.minWordCount && (
                                <div className="flex items-center gap-2">
                                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                                  <span className="text-gray-500 dark:text-gray-400">Min Words:</span>
                                  <span className="font-medium ml-1">{(website as any).meta.minWordCount.toLocaleString()}</span>
                                </div>
                              )}
                              {(website as any).meta?.maxLinks && (
                                <div className="flex items-center gap-2">
                                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                                  <span className="text-gray-500 dark:text-gray-400">Max Links:</span>
                                  <span className="font-medium ml-1">{(website as any).meta.maxLinks}</span>
                                </div>
                              )}
                              {!((website as any).meta?.minWordCount) && !((website as any).meta?.maxLinks) && (
                                <span className="text-gray-400">Not set</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <div className="flex items-center justify-end space-x-2">
                              {website.pricing?.guestPost && (
                                <button onClick={() => handleOrderClick(website, 'guestPost')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-1.5 px-3 rounded">Add GP</button>
                              )}
                              {website.pricing?.linkInsertion && (
                                <button onClick={() => handleOrderClick(website, 'linkInsertion')} className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-1.5 px-3 rounded">Add LI</button>
                              )}
                              {/* Writing + Guest Posting adds a writing item; uses dedicated price if available */}
                              {(website as any).pricing?.writingGuestPost && (
                                <button
                                  onClick={() => {
                                    const writingPrice = Number((website as any).pricing?.writingGuestPost ?? 0)
                                    dispatch(addItem({
                                      websiteId: website._id,
                                      domain: website.domain || new URL(website.url).hostname.replace('www.', ''),
                                      type: 'writingGuestPost',
                                      price: writingPrice,
                                    }))
                                    router.push('/advertiser/cart')
                                  }}
                                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium py-1.5 px-3 rounded"
                                >
                                  Writing + GP
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleFilterChange({ page: currentPage - 1 })}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handleFilterChange({ page })}
                      className={`px-3 py-2 text-sm font-medium rounded-lg ${
                        page === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => handleFilterChange({ page: currentPage + 1 })}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Order Modal */}
        {showOrderModal && selectedWebsite && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Place {orderType === 'guestPost' ? 'Guest Post' : 'Link Insertion'} Order
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Website:</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedWebsite.domain || new URL(selectedWebsite.url).hostname.replace('www.', '')}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedWebsite.domain}</p>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Price:</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  ${orderType === 'guestPost' ? selectedWebsite.pricing?.guestPost : selectedWebsite.pricing?.linkInsertion}
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleOrderSubmit({ website: selectedWebsite, type: orderType })}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                >
                  Place Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}