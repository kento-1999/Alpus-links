"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, Send, ChevronDown, Search } from 'lucide-react'
import { apiService } from '@/lib/api'
import toast from 'react-hot-toast'
import { useAppDispatch } from '@/hooks/redux'
import { addPostToCart } from '@/store/slices/cartSlice'

interface WritingGPForm {
  title: string
  domain: string
  description: string
  content: string
  metaTitle?: string
  metaDescription?: string
  keywords?: string
  anchorPairs: { text: string; link: string }[]
}

export default function EditWritingGPPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const postId = (params?.id as string) || ''
  const dispatch = useAppDispatch()
  
  // Check if this is a view-only mode (from orders page)
  const isViewOnly = searchParams.get('viewOnly') === 'true'
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<WritingGPForm>({
    title: '',
    domain: '',
    description: '',
    content: '',
    anchorPairs: [{ text: '', link: '' }]
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [postStatus, setPostStatus] = useState<string>('draft')
  const [orderStatus, setOrderStatus] = useState<string | null>(null)
  const [websites, setWebsites] = useState<any[]>([])
  const [loadingWebsites, setLoadingWebsites] = useState(false)
  const [showDomainDropdown, setShowDomainDropdown] = useState(false)
  const [domainSearchTerm, setDomainSearchTerm] = useState('')
  const [domainError, setDomainError] = useState('')
  const [isDomainFromCart, setIsDomainFromCart] = useState(false)

  // Fetch orders to check if this post is associated with any orders
  const fetchOrderStatus = async (domain: string) => {
    try {
      // Fetch all advertiser orders to find orders associated with this post
      const response = await apiService.getAdvertiserOrders({})
      
      // Handle different API response structures
      const orders = (response.data as any)?.data?.orders || (response.data as any)?.orders || []
      
      // Find orders where postId matches this post OR domain matches for writing-gp orders
      const relatedOrder = orders.find((order: any) => {
        const orderPostId = order.postId?._id || order.postId
        const isPostMatch = orderPostId === postId
        
        // For writing-gp orders, also check by domain
        const websiteDomain = order.websiteId?.domain || ''
        const normalizedWebsiteDomain = websiteDomain.toLowerCase().replace('www.', '')
        const normalizedFormDomain = domain.toLowerCase().replace('www.', '')
        const isDomainMatch = order.type === 'writingGuestPost' && domain && 
          normalizedWebsiteDomain === normalizedFormDomain
        
        return isPostMatch || isDomainMatch
      })
      
      if (relatedOrder) {
        setOrderStatus(relatedOrder.status)
      }
    } catch (error) {
      console.error('Error fetching order status:', error)
      // Don't show error to user, just silently fail
    }
  }

  // Check if buttons should be hidden based on order status
  const shouldHideButtons = () => {
    if (isViewOnly) return true
    // Check both post status and order status
    const statusToCheck = orderStatus || postStatus
    if (!statusToCheck) return false
    // Hide buttons when status is: requested, inProgress, rejected, or completed
    // Also hide for 'request' (display status) and 'approved' (post status)
    const hideStatuses = ['requested', 'request', 'inProgress', 'rejected', 'completed', 'approved']
    return hideStatuses.includes(statusToCheck)
  }

  // Load post data
  useEffect(() => {
    const loadPost = async () => {
      if (!postId) return
      
      try {
        setLoading(true)
        const { data } = await apiService.getPost(postId)
        const post = data?.post
        
        if (!post) {
          toast.error('Post not found')
          router.push('/advertiser/project')
          return
        }
        
        // Extract domain from completeUrl
        const domain = post.completeUrl ? new URL(post.completeUrl).hostname.replace('www.', '') : ''
        
        setFormData({
          title: post.title || '',
          domain: domain,
          description: post.description || '',
          content: post.content || '',
          metaTitle: post.metaTitle || '',
          metaDescription: post.metaDescription || '',
          keywords: post.keywords || '',
          anchorPairs: post.anchorPairs || [{ text: '', link: '' }]
        })
        setPostStatus(post.status || 'draft')
        
        // Check for associated orders after post is loaded
        await fetchOrderStatus(domain)
      } catch (error: any) {
        console.error('Load error:', error)
        toast.error(error?.message || 'Failed to load post')
        router.push('/advertiser/project')
      } finally {
        setLoading(false)
      }
    }
    
    loadPost()
  }, [postId, router])

  // Load advertiser websites for domain dropdown
  useEffect(() => {
    const loadWebsites = async () => {
      try {
        setLoadingWebsites(true)
        const response = await apiService.getAdvertiserWebsites({ page: 1, limit: 100, search: domainSearchTerm })
        if ((response.data as any)?.websites) setWebsites((response.data as any).websites)
      } catch (e) {
        console.error('Failed to load websites', e)
        toast.error('Failed to load websites')
      } finally {
        setLoadingWebsites(false)
      }
    }
    loadWebsites()
  }, [domainSearchTerm])

  const filteredWebsites = websites.filter((website) => {
    if (!domainSearchTerm.trim()) return true
    return website.domain?.toLowerCase().includes(domainSearchTerm.toLowerCase()) ||
           website.url?.toLowerCase().includes(domainSearchTerm.toLowerCase())
  })

  const validateDomain = (domain: string): string => {
    if (!domain) return 'Target Domain is required'
    try {
      const testUrl = domain.startsWith('http') ? domain : `https://${domain}`
      new URL(testUrl)
      return ''
    } catch {
      return 'Please enter a valid domain (e.g., https://example.com or example.com)'
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!formData.title.trim()) e.title = 'Title is required'
    
    const domainError = validateDomain(formData.domain)
    if (domainError) e.domain = domainError
    
    // Check if content is provided
    if (!formData.content.trim()) e.content = 'Content is required'
    
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const setField = (key: keyof WritingGPForm, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const addAnchorPair = () => {
    setFormData(prev => ({
      ...prev,
      anchorPairs: [...prev.anchorPairs, { text: '', link: '' }]
    }))
  }

  const removeAnchorPair = (index: number) => {
    setFormData(prev => ({
      ...prev,
      anchorPairs: prev.anchorPairs.filter((_, i) => i !== index)
    }))
  }

  const updateAnchorPair = (index: number, field: 'text' | 'link', value: string) => {
    setFormData(prev => ({
      ...prev,
      anchorPairs: prev.anchorPairs.map((pair, i) => 
        i === index ? { ...pair, [field]: value } : pair
      )
    }))
  }

  const formatSlugForBackend = (text: string): string => {
    const base = (text || 'untitled')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim() || 'untitled'
    return base
  }

  const buildCompleteUrl = (): string => {
    const domain = formData.domain
    const slug = formatSlugForBackend(formData.title)
    
    if (!domain) return ''
    
    // Ensure domain has protocol
    const domainWithProtocol = domain.startsWith('http') ? domain : `https://${domain}`
    
    if (slug && slug !== 'untitled') {
      return `${domainWithProtocol}/${slug}`
    }
    
    return domainWithProtocol
  }

  const saveDraft = async () => {
    // Check requirements field first
    if (!formData.content.trim()) {
      toast.error('Requirements input is required')
      return
    }
    
    if (!validate()) return toast.error('Please fix errors')
    
    try {
      setSaving(true)
      
      // Filter out empty anchor pairs and ensure no duplicates
      const validAnchorPairs = formData.anchorPairs
        .filter(pair => pair.text.trim() && pair.link.trim())
        .map(pair => ({
          text: pair.text.trim(),
          link: pair.link.trim()
        }))
      
      // Remove duplicates based on text and link combination
      const uniqueAnchorPairs = validAnchorPairs.filter((pair, index, self) => 
        index === self.findIndex(p => p.text === pair.text && p.link === pair.link)
      )
      
      await apiService.updatePost(postId, {
        title: formData.title,
        completeUrl: buildCompleteUrl(),
        description: formData.description,
        content: formData.content,
        metaTitle: formData.metaTitle,
        metaDescription: formData.metaDescription,
        keywords: formData.keywords,
        anchorPairs: uniqueAnchorPairs,
        postType: 'writing-gp',
        status: 'draft' // Ensure it stays as draft
      })
      toast.success('Draft updated')
      router.push('/advertiser/project')
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Failed to update draft')
    } finally {
      setSaving(false)
    }
  }

  const submit = async () => {
    // Check requirements field first
    if (!formData.content.trim()) {
      toast.error('Requirements input is required')
      return
    }
    
    if (!validate()) return toast.error('Please fix errors')
    
    try {
      setSaving(true)
      
      // Filter out empty anchor pairs and ensure no duplicates
      const validAnchorPairs = formData.anchorPairs
        .filter(pair => pair.text.trim() && pair.link.trim())
        .map(pair => ({
          text: pair.text.trim(),
          link: pair.link.trim()
        }))
      
      // Remove duplicates based on text and link combination
      const uniqueAnchorPairs = validAnchorPairs.filter((pair, index, self) => 
        index === self.findIndex(p => p.text === pair.text && p.link === pair.link)
      )
      
      const submitData = {
        title: formData.title,
        completeUrl: buildCompleteUrl(),
        description: formData.description,
        content: formData.content,
        metaTitle: formData.metaTitle,
        metaDescription: formData.metaDescription,
        keywords: formData.keywords,
        anchorPairs: uniqueAnchorPairs,
        postType: 'writing-gp',
        status: 'pending' // Add status change to pending
      }
      
      console.log('Updating Writing + GP post:', submitData)
      await apiService.updatePost(postId, submitData)
      
      // Find the website by domain to get websiteId and price
      const website = websites.find(w => {
        const websiteDomain = w.domain || new URL(w.url).hostname.replace('www.', '')
        const formDomain = formData.domain.replace(/^https?:\/\//, '').replace('www.', '')
        return websiteDomain.toLowerCase() === formDomain.toLowerCase()
      })
      
      if (!website) {
        toast.error('Website not found for the selected domain')
        return
      }
      
      // Add the post to cart
      dispatch(addPostToCart({
        websiteId: website._id,
        domain: website.domain || new URL(website.url).hostname.replace('www.', ''),
        type: 'writingGuestPost',
        price: website.pricing?.writingGuestPost || website.pricing?.guestPost || 0,
        selectedPostId: postId
      }))
      
      toast.success('Writing + GP updated and added to cart')
      router.push('/advertiser/cart')
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Failed to submit')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["advertiser"]}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4">Loading post...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["advertiser"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center space-x-3 mb-8">
            <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Writing + GP</h1>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
              <input 
                value={formData.title} 
                onChange={e => setField('title', e.target.value)} 
                disabled={isViewOnly}
                className={`w-full px-3 py-2 rounded-xl border ${errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`} 
              />
              {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
            </div>

            {/* Target Domain */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Domain</label>
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    value={formData.domain}
                    disabled={isDomainFromCart || isViewOnly}
                    onChange={(e) => {
                      if (!isDomainFromCart && !isViewOnly) {
                        const value = e.target.value
                        setField('domain', value)
                        setDomainSearchTerm(value)
                        setShowDomainDropdown(true)
                        setDomainError(validateDomain(value))
                      }
                    }}
                    onFocus={() => {
                      if (!isDomainFromCart && !isViewOnly) {
                        setShowDomainDropdown(true)
                      }
                    }}
                    onBlur={(e) => {
                      if (!isDomainFromCart && !isViewOnly) {
                        const relatedTarget = e.relatedTarget as HTMLElement
                        if (!relatedTarget || !relatedTarget.closest('[data-domain-dropdown]')) {
                          setTimeout(() => setShowDomainDropdown(false), 150)
                        }
                      }
                    }}
                    placeholder={isDomainFromCart ? "Domain selected from cart" : "Select a domain..."}
                    className={`w-full px-3 py-2 pr-10 rounded-xl border ${domainError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} ${isDomainFromCart || isViewOnly ? 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'}`}
                  />
                  {!isDomainFromCart && !isViewOnly && (
                    <button
                      type="button"
                      onClick={() => setShowDomainDropdown(!showDomainDropdown)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                    >
                      <ChevronDown className={`w-5 h-5 transition-transform ${showDomainDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>

                {!isDomainFromCart && showDomainDropdown && (
                  <div data-domain-dropdown className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    {loadingWebsites ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
                        <p className="mt-2">Loading domains...</p>
                      </div>
                    ) : filteredWebsites.length > 0 ? (
                      filteredWebsites.map((website) => {
                        const domain = website.domain || new URL(website.url).hostname.replace('www.', '')
                        return (
                          <button
                            key={website._id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setFormData(prev => ({ ...prev, domain }))
                              setDomainSearchTerm(domain)
                              setShowDomainDropdown(false)
                              setDomainError('')
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-purple-50 dark:hover:bg-purple-900/20 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${formData.domain === domain ? 'bg-purple-100 dark:bg-purple-900/30' : ''}`}
                          >
                            <div className="font-medium text-gray-900 dark:text-white">{domain}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{website.url}</div>
                          </button>
                        )
                      })
                    ) : (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        <p>No domains found</p>
                        <p className="text-xs mt-1">Try a different search term</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {domainError && <p className="text-sm text-red-600 mt-1">{domainError}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Requirements</label>
              <textarea 
                value={formData.content} 
                onChange={e => setField('content', e.target.value)} 
                rows={8} 
                placeholder="Describe your content requirements, target audience, tone, and any specific guidelines..."
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
              />
            </div>

            {/* Anchor Text and Link Fields */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Anchor Pairs</label>
                {!shouldHideButtons() && (
                <button
                  type="button"
                  onClick={addAnchorPair}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
                >
                  <span>+</span>
                  Add Anchor Pair
                </button>
                )}
              </div>
              
              {formData.anchorPairs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No anchor pairs added yet</p>
                  <p className="text-sm">Click "Add Anchor Pair" to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.anchorPairs.map((pair, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anchor Text</label>
                        <input 
                          value={pair.text} 
                          onChange={e => updateAnchorPair(index, 'text', e.target.value)} 
                          placeholder="Enter anchor text..."
                          disabled={isViewOnly}
                          className={`w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`} 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anchor Link</label>
                        <input 
                          value={pair.link} 
                          onChange={e => updateAnchorPair(index, 'link', e.target.value)} 
                          placeholder="Enter anchor link..."
                          disabled={isViewOnly}
                          className={`w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`} 
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        {!isViewOnly && (
                          <button
                            type="button"
                            onClick={() => removeAnchorPair(index)}
                            className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!shouldHideButtons() && (
              <div className="flex gap-3">
                <button onClick={saveDraft} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white py-3 rounded-xl disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                </button>
                <button onClick={submit} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                  <Send className="w-4 h-4" />
                  <span>{saving ? 'Submitting...' : 'Send to Moderation'}</span>
                </button>
              </div>
            )}
            
            {/* View Only Notice */}
            {isViewOnly && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
                  <Search className="w-5 h-5" />
                  <span className="font-medium">View Only Mode</span>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  You are viewing this writing + GP post from an order. Editing is disabled to prevent conflicts with ongoing work.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}