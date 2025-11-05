"use client"
import { useState } from 'react'
import { Edit, Trash2, MoreHorizontal, AlertTriangle, X } from 'lucide-react'

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

interface WebsiteTableProps {
  websites: Website[]
  loading: boolean
  onEdit: (website: Website) => void
  onDelete: (websiteId: string) => void
}

const statusColors = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800'
}

const categoryColors = {
  technology: 'bg-blue-100 text-blue-800',
  business: 'bg-purple-100 text-purple-800',
  health: 'bg-green-100 text-green-800',
  finance: 'bg-yellow-100 text-yellow-800',
  education: 'bg-indigo-100 text-indigo-800',
  lifestyle: 'bg-pink-100 text-pink-800',
  travel: 'bg-cyan-100 text-cyan-800',
  food: 'bg-orange-100 text-orange-800',
  sports: 'bg-red-100 text-red-800',
  entertainment: 'bg-purple-100 text-purple-800',
  news: 'bg-gray-100 text-gray-800',
  fashion: 'bg-rose-100 text-rose-800',
  beauty: 'bg-pink-100 text-pink-800',
  parenting: 'bg-amber-100 text-amber-800',
  home: 'bg-emerald-100 text-emerald-800',
  automotive: 'bg-slate-100 text-slate-800',
  gaming: 'bg-violet-100 text-violet-800',
  photography: 'bg-sky-100 text-sky-800',
  music: 'bg-fuchsia-100 text-fuchsia-800',
  art: 'bg-amber-100 text-amber-800',
  other: 'bg-gray-100 text-gray-800'
}

export function WebsiteTable({
  websites,
  loading,
  onEdit,
  onDelete
}: WebsiteTableProps) {
  const [sortField, setSortField] = useState<keyof Website>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [websiteToDelete, setWebsiteToDelete] = useState<Website | null>(null)

  const handleSort = (field: keyof Website) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatNumber = (num?: number) => {
    if (!num) return 'N/A'
    return num.toLocaleString()
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A'
    return `$${amount.toLocaleString()}`
  }

  const handleDeleteClick = (website: Website) => {
    setWebsiteToDelete(website)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = () => {
    if (websiteToDelete) {
      onDelete(websiteToDelete._id)
      setShowDeleteModal(false)
      setWebsiteToDelete(null)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false)
    setWebsiteToDelete(null)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (websites.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-12 text-center">
          <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No websites found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Get started by adding your first website to the platform.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('domain')}
              >
                <div className="flex items-center space-x-1">
                  <span>Website</span>
                  {sortField === 'domain' && (
                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('categories')}
              >
                <div className="flex items-center space-x-1">
                  <span>Category</span>
                  {sortField === 'categories' && (
                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Metrics
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Pricing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Requirements
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  {sortField === 'status' && (
                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center space-x-1">
                  <span>Created</span>
                  {sortField === 'createdAt' && (
                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {websites.map((website) => {
              // Debug logging
              console.log('Website categories for', website.domain, ':', website.categories);
              return (
              <tr key={website._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {website.domain}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <a
                        href={website.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {website.url}
                      </a>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    {website.categories && website.categories.length > 0 ? (
                      website.categories.slice(0, 2).map((cat, index) => (
                        <span
                          key={index}
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            categoryColors[cat.name as keyof typeof categoryColors] || categoryColors.other
                          }`}
                        >
                          {cat.name}
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                        No categories
                      </span>
                    )}
                    {website.categories && website.categories.length > 2 && (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                        +{website.categories.length - 2} more
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-400">Moz DA:</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {website.meta?.mozDA ? `${website.meta.mozDA}/100` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-400">Ahrefs DR:</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {website.meta?.ahrefsDR ? `${website.meta.ahrefsDR}/100` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-400">Semrush:</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {website.meta?.semrushTraffic ? formatNumber(website.meta.semrushTraffic) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  <div className="flex flex-col space-y-1">
                    {website.pricing?.guestPost && (
                      <div>Guest Post: {formatCurrency(website.pricing.guestPost)}</div>
                    )}
                    {website.pricing?.linkInsertion && (
                      <div>Link Insertion: {formatCurrency(website.pricing.linkInsertion)}</div>
                    )}
                    {website.pricing?.extraLinks && (
                      <div>Extra Links: {formatCurrency(website.pricing.extraLinks)}</div>
                    )}
                    {website.pricing?.writingGuestPost && (
                      <div>Writing + GP: {formatCurrency(website.pricing.writingGuestPost)}</div>
                    )}
                    {!website.pricing?.guestPost && !website.pricing?.linkInsertion && !website.pricing?.extraLinks && !website.pricing?.writingGuestPost && (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  <div className="flex flex-col space-y-1">
                    {website.turnaroundTimeDays && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-600 dark:text-gray-400">TAT:</span>
                        <span className="font-medium">{website.turnaroundTimeDays} days</span>
                      </div>
                    )}
                    {website.meta?.minWordCount && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-600 dark:text-gray-400">Min Words:</span>
                        <span className="font-medium">{website.meta.minWordCount.toLocaleString()}</span>
                      </div>
                    )}
                    {website.meta?.maxLinks && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-gray-600 dark:text-gray-400">Max Links:</span>
                        <span className="font-medium">{website.meta.maxLinks}</span>
                      </div>
                    )}
                    {!website.turnaroundTimeDays && !website.meta?.minWordCount && !website.meta?.maxLinks && (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    statusColors[website.status]
                  }`}>
                    {website.status.charAt(0).toUpperCase() + website.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(website.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onEdit(website)}
                      className="group inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-200 hover:shadow-md"
                      title="Edit website"
                    >
                      <Edit className="w-4 h-4 mr-1.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(website)}
                      className="group inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 hover:shadow-md"
                      title="Delete website"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && websiteToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Delete Website
                  </h3>
                </div>
                <button
                  onClick={handleDeleteCancel}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="mb-6">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete this website? This action cannot be undone.
                </p>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg flex items-center justify-center">
                      <img 
                        alt={websiteToDelete.domain} 
                        src={`https://www.google.com/s2/favicons?domain=${websiteToDelete.domain}&sz=32`} 
                        className="w-6 h-6 rounded" 
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {websiteToDelete.domain}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {websiteToDelete.url}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <button
                  onClick={handleDeleteCancel}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
