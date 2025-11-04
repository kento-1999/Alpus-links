"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppDispatch } from '@/hooks/redux'
import { addItem } from '@/store/slices/cartSlice'
import { addPostToCart } from '@/store/slices/cartSlice'
import { ArrowLeft, Save, Send, ChevronDown, Search } from 'lucide-react'
import { apiService } from '@/lib/api'
import toast from 'react-hot-toast'

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

export default function WritingGPPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<WritingGPForm>({
    title: '',
    domain: '',
    description: '',
    content: '',
    anchorPairs: [{ text: '', link: '' }]
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [websites, setWebsites] = useState<any[]>([])
  const [loadingWebsites, setLoadingWebsites] = useState(false)
  const [showDomainDropdown, setShowDomainDropdown] = useState(false)
  const [domainSearchTerm, setDomainSearchTerm] = useState('')
  const [domainError, setDomainError] = useState('')
  const [isDomainFromCart, setIsDomainFromCart] = useState(false)

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

  // Pre-populate domain from cart if provided
  useEffect(() => {
    const domainFromCart = searchParams.get('domain')
    const fromCart = searchParams.get('from') === 'cart'
    
    if (domainFromCart && fromCart) {
      setFormData(prev => ({ ...prev, domain: domainFromCart }))
      setDomainSearchTerm(domainFromCart)
      setIsDomainFromCart(true)
    }
  }, [searchParams])

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
      const isFromCart = searchParams.get('from') === 'cart'
      await apiService.savePostDraft({
        title: formData.title,
        completeUrl: buildCompleteUrl(),
        description: formData.description,
        content: formData.content,
        metaTitle: formData.metaTitle,
        metaDescription: isFromCart ? 'cart-created' : formData.metaDescription,
        keywords: isFromCart ? 'cart-created' : formData.keywords,
        anchorPairs: formData.anchorPairs.filter(pair => pair.text.trim() && pair.link.trim()),
        postType: 'writing-gp'
      })
      toast.success('Draft saved')
      router.push('/advertiser/project')
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Failed to save draft')
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
      const isFromCart = searchParams.get('from') === 'cart'
      const submitData = {
        title: formData.title,
        completeUrl: buildCompleteUrl(),
        description: formData.description,
        content: formData.content,
        metaTitle: formData.metaTitle,
        metaDescription: isFromCart ? 'cart-created' : formData.metaDescription,
        keywords: isFromCart ? 'cart-created' : formData.keywords,
        anchorPairs: formData.anchorPairs.filter(pair => pair.text.trim() && pair.link.trim()),
        postType: 'writing-gp',
        status: 'pending'
      }
      
      console.log('Submitting Writing + GP post:', submitData)
      const response = await apiService.submitPost(submitData)
      const postId = (response.data as any)?.post?._id
      
      if (!postId) {
        toast.error('Failed to get post ID from response')
        return
      }
      
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
      
      toast.success('Post submitted and added to cart')
      router.push('/advertiser/cart')
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Failed to submit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={["advertiser"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center space-x-3 mb-8">
            <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Writing + GP</h1>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
              <input value={formData.title} onChange={e => setField('title', e.target.value)} className={`w-full px-3 py-2 rounded-xl border ${errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`} />
              {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
            </div>

            {/* Target Domain (same UX as Create Post) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Domain</label>
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    value={formData.domain}
                    disabled={isDomainFromCart}
                    onChange={(e) => {
                      if (!isDomainFromCart) {
                        const value = e.target.value
                        setField('domain', value)
                        setDomainSearchTerm(value)
                        setShowDomainDropdown(true)
                        setDomainError(validateDomain(value))
                      }
                    }}
                    onFocus={() => {
                      if (!isDomainFromCart) {
                        setShowDomainDropdown(true)
                      }
                    }}
                    onBlur={(e) => {
                      if (!isDomainFromCart) {
                        const relatedTarget = e.relatedTarget as HTMLElement
                        if (!relatedTarget || !relatedTarget.closest('[data-domain-dropdown]')) {
                          setTimeout(() => setShowDomainDropdown(false), 150)
                        }
                      }
                    }}
                    placeholder={isDomainFromCart ? "Domain selected from cart" : "Select a domain..."}
                    className={`w-full px-3 py-2 pr-10 rounded-xl border ${domainError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} ${isDomainFromCart ? 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'}`}
                  />
                  {!isDomainFromCart && (
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

            {/* URL preview removed as requested */}

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
                <button
                  type="button"
                  onClick={addAnchorPair}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
                >
                  <span>+</span>
                  Add Anchor Pair
                </button>
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
                          className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anchor Link</label>
                        <input 
                          value={pair.link} 
                          onChange={e => updateAnchorPair(index, 'link', e.target.value)} 
                          placeholder="Enter anchor link..."
                          className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeAnchorPair(index)}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}


