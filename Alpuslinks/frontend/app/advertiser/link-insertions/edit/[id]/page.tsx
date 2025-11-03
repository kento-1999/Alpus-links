"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, Send, Link, Unlink, Plus, Trash2, Edit3, ExternalLink } from 'lucide-react'
import { apiService } from '@/lib/api'
import toast from 'react-hot-toast'

interface LinkInsertion {
  id?: string
  postUrl: string
  anchorText: string
  anchorUrl: string
  currentText: string
  fixedText: string
  addingText: string
  status?: 'draft' | 'pending' | 'approved' | 'rejected'
  createdAt?: string
  updatedAt?: string
}

export default function EditLinkInsertionPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const linkInsertionId = (params?.id as string) || ''
  
  // Check if this is a view-only mode (from orders page)
  const isViewOnly = searchParams.get('viewOnly') === 'true'
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<LinkInsertion>({
    postUrl: '',
    anchorText: '',
    anchorUrl: '',
    currentText: '',
    fixedText: '',
    addingText: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load link insertion data
  useEffect(() => {
    const loadLinkInsertion = async () => {
      if (!linkInsertionId) return
      
      try {
        setLoading(true)
        const { data } = await apiService.getLinkInsertion(linkInsertionId)
        const li = data as LinkInsertion
        
        if (!li) {
          toast.error('Link insertion not found')
          router.push('/advertiser/link-insertions')
          return
        }
        
        setFormData({
          id: li.id,
          postUrl: li.postUrl || '',
          anchorText: li.anchorText || '',
          anchorUrl: li.anchorUrl || '',
          currentText: li.currentText || '',
          fixedText: li.fixedText || '',
          addingText: li.addingText || '',
          status: li.status,
          createdAt: li.createdAt,
          updatedAt: li.updatedAt
        })
      } catch (error: any) {
        console.error('Load error:', error)
        toast.error(error?.message || 'Failed to load link insertion')
        router.push('/advertiser/link-insertions')
      } finally {
        setLoading(false)
      }
    }
    
    loadLinkInsertion()
  }, [linkInsertionId, router])

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.postUrl.trim()) {
      newErrors.postUrl = 'Post URL is required'
    } else if (!isValidUrl(formData.postUrl)) {
      newErrors.postUrl = 'Please enter a valid URL'
    }

    if (!formData.anchorText.trim()) {
      newErrors.anchorText = 'Anchor text is required'
    }

    if (!formData.anchorUrl.trim()) {
      newErrors.anchorUrl = 'Anchor URL is required'
    } else if (!isValidUrl(formData.anchorUrl)) {
      newErrors.anchorUrl = 'Please enter a valid URL'
    }

    if (!formData.currentText.trim()) {
      newErrors.currentText = 'Current text is required'
    }

    if (!formData.fixedText.trim()) {
      newErrors.fixedText = 'Fixed text is required'
    }

    if (!formData.addingText.trim()) {
      newErrors.addingText = 'Adding text is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // URL validation helper
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const handleInputChange = (field: keyof LinkInsertion, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const handleSaveDraft = async () => {
    if (!validateForm()) {
      toast.error('Please fix all errors before saving')
      return
    }

    try {
      setSaving(true)
      await apiService.updateLinkInsertion(linkInsertionId, {
        ...formData,
        status: 'draft'
      })
      toast.success('Link insertion updated')
      router.push('/advertiser/link-insertions')
    } catch (error: any) {
      console.error('Update error:', error)
      toast.error(error?.message || 'Failed to update link insertion')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix all errors before submitting')
      return
    }

    try {
      setSaving(true)
      await apiService.updateLinkInsertion(linkInsertionId, {
        ...formData,
        status: 'pending'
      })
      toast.success('Link insertion submitted for review')
      router.push('/advertiser/link-insertions')
    } catch (error: any) {
      console.error('Submit error:', error)
      toast.error(error?.message || 'Failed to submit link insertion')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["advertiser"]}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4">Loading link insertion...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["advertiser"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center space-x-4 mb-6">
              <button
                onClick={() => router.back()}
                className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-200 hover:scale-105"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Edit Link Insertion
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Update your link insertion request with detailed specifications
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/30 dark:border-gray-700/50 overflow-hidden hover:shadow-3xl transition-all duration-300">
            <div className="p-8">
              {/* Post URL */}
              <div className="mb-8">
                <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-4"></div>
                  Post URL *
                </label>
                <div className="relative group">
                  <input
                    type="url"
                    value={formData.postUrl}
                    onChange={(e) => handleInputChange('postUrl', e.target.value)}
                    placeholder="https://example.com/post-title"
                    disabled={isViewOnly}
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 transition-all duration-300 text-lg font-mono ${
                      errors.postUrl 
                        ? 'bg-white dark:bg-gray-800 border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-blue-500/20 focus:border-blue-500'
                    } ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  <ExternalLink className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                {errors.postUrl && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                    <span className="w-4 h-4 mr-2">⚠️</span>
                    {errors.postUrl}
                  </p>
                )}
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  The URL of the post where you want to insert the link
                </p>
              </div>

              {/* Anchor Text */}
              <div className="mb-8">
                <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-4"></div>
                  Anchor Text *
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={formData.anchorText}
                    onChange={(e) => handleInputChange('anchorText', e.target.value)}
                    placeholder="Click here to learn more"
                    disabled={isViewOnly}
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 transition-all duration-300 text-lg font-semibold ${
                      errors.anchorText 
                        ? 'bg-white dark:bg-gray-800 border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-green-500/20 focus:border-green-500'
                    } ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  <Link className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                {errors.anchorText && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                    <span className="w-4 h-4 mr-2">⚠️</span>
                    {errors.anchorText}
                  </p>
                )}
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  The clickable text that will contain the link
                </p>
              </div>

              {/* Anchor URL */}
              <div className="mb-8">
                <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mr-4"></div>
                  Anchor URL *
                </label>
                <div className="relative group">
                  <input
                    type="url"
                    value={formData.anchorUrl}
                    onChange={(e) => handleInputChange('anchorUrl', e.target.value)}
                    placeholder="https://your-website.com/target-page"
                    disabled={isViewOnly}
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 transition-all duration-300 text-lg font-mono ${
                      errors.anchorUrl 
                        ? 'bg-white dark:bg-gray-800 border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-purple-500/20 focus:border-purple-500'
                    } ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  <ExternalLink className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                {errors.anchorUrl && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                    <span className="w-4 h-4 mr-2">⚠️</span>
                    {errors.anchorUrl}
                  </p>
                )}
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  The destination URL where the link should point
                </p>
              </div>

              {/* Current Text */}
              <div className="mb-8">
                <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                  <div className="w-3 h-3 bg-orange-500 rounded-full mr-4"></div>
                  Current Text *
                </label>
                <div className="relative group">
                  <textarea
                    value={formData.currentText}
                    onChange={(e) => handleInputChange('currentText', e.target.value)}
                    placeholder="The existing text in the post that needs to be modified..."
                    rows={4}
                    disabled={isViewOnly}
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 transition-all duration-300 text-lg resize-none ${
                      errors.currentText 
                        ? 'bg-white dark:bg-gray-800 border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-orange-500/20 focus:border-orange-500'
                    } ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
                {errors.currentText && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                    <span className="w-4 h-4 mr-2">⚠️</span>
                    {errors.currentText}
                  </p>
                )}
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  The existing text in the post that will be replaced or modified
                </p>
              </div>

              {/* Fixed Text */}
              <div className="mb-8">
                <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                  <div className="w-3 h-3 bg-teal-500 rounded-full mr-4"></div>
                  Fixed Text *
                </label>
                <div className="relative group">
                  <textarea
                    value={formData.fixedText}
                    onChange={(e) => handleInputChange('fixedText', e.target.value)}
                    placeholder="The corrected or improved text that should replace the current text..."
                    rows={4}
                    disabled={isViewOnly}
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 transition-all duration-300 text-lg resize-none ${
                      errors.fixedText 
                        ? 'bg-white dark:bg-gray-800 border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-teal-500/20 focus:border-teal-500'
                    } ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
                {errors.fixedText && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                    <span className="w-4 h-4 mr-2">⚠️</span>
                    {errors.fixedText}
                  </p>
                )}
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  The corrected or improved text that should replace the current text
                </p>
              </div>

              {/* Adding Text */}
              <div className="mb-8">
                <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-4"></div>
                  Adding Text *
                </label>
                <div className="relative group">
                  <textarea
                    value={formData.addingText}
                    onChange={(e) => handleInputChange('addingText', e.target.value)}
                    placeholder="Additional text or context that should be added to the post..."
                    rows={4}
                    disabled={isViewOnly}
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 transition-all duration-300 text-lg resize-none ${
                      errors.addingText 
                        ? 'bg-white dark:bg-gray-800 border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-yellow-500/20 focus:border-yellow-500'
                    } ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
                {errors.addingText && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                    <span className="w-4 h-4 mr-2">⚠️</span>
                    {errors.addingText}
                  </p>
                )}
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Additional text or context that should be added to the post
                </p>
              </div>

              {/* Status Display */}
              {formData.status && (
                <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Status</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formData.status === 'draft' && 'Draft - Not submitted for review'}
                        {formData.status === 'pending' && 'Pending - Awaiting review'}
                        {formData.status === 'approved' && 'Approved - Ready for implementation'}
                        {formData.status === 'rejected' && 'Rejected - Needs revision'}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      formData.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      formData.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      formData.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {formData.status?.charAt(0).toUpperCase() + formData.status?.slice(1)}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!isViewOnly && !(['request','inProgress','approved','rejected','completed'].includes(String(formData.status || '')))) && (
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    <span>{saving ? 'Saving...' : 'Update Draft'}</span>
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                    <span>{saving ? 'Submitting...' : 'Send to Moderation'}</span>
                  </button>
                </div>
              )}
              
              {/* View Only Notice */}
              {isViewOnly && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mt-6">
                  <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
                    <ExternalLink className="w-5 h-5" />
                    <span className="font-medium">View Only Mode</span>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    You are viewing this link insertion from an order. Editing is disabled to prevent conflicts with ongoing work.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
