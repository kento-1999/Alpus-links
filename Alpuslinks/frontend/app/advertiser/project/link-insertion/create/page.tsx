"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, Send } from 'lucide-react'
import { apiService } from '@/lib/api'
import toast from 'react-hot-toast'
import { useAppDispatch } from '@/hooks/redux'
import { addPostToCart } from '@/store/slices/cartSlice'

interface LinkInsertionAsPost {
  title: string
  completeUrl: string
  requirements?: string
  metaTitle?: string
  metaDescription?: string
  keywords?: string
  anchorPairs: Array<{ text: string; link: string }>
}

export default function CreateLinkInsertionAsPostPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const [saving, setSaving] = useState(false)
  const [websites, setWebsites] = useState<any[]>([])
  const [cartDomain, setCartDomain] = useState<string | null>(null)
  const [formData, setFormData] = useState<LinkInsertionAsPost>({
    title: '',
    completeUrl: '',
    requirements: '',
    metaTitle: '',
    metaDescription: '',
    keywords: '',
    anchorPairs: [
      { text: '', link: '' }
    ],
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch websites for domain validation
  const fetchWebsites = async () => {
    try {
      const response = await apiService.getAdvertiserWebsites({
        page: 1,
        limit: 100
      })
      
      if ((response.data as any)?.websites) {
        setWebsites((response.data as any).websites)
      }
    } catch (error) {
      console.error('Error fetching websites:', error)
      toast.error('Failed to load websites')
    }
  }

  // Check if entered domain exists in available websites list
  const isDomainAvailable = (): boolean => {
    if (!formData.completeUrl.trim()) return false
    
    try {
      const url = new URL(formatUrl(formData.completeUrl))
      const domain = url.hostname.replace(/^www\./, '').toLowerCase()
      
      return websites.some(w => {
        try {
          const websiteDomain = (w.domain || new URL(w.url).hostname).replace(/^www\./, '').toLowerCase()
          return websiteDomain === domain
        } catch {
          return false
        }
      })
    } catch {
      return false
    }
  }

  // Get domain from URL parameters
  useEffect(() => {
    const domain = searchParams.get('domain')
    if (domain) {
      setCartDomain(decodeURIComponent(domain))
    }
  }, [searchParams])

  // Fetch websites on component mount
  useEffect(() => {
    fetchWebsites()
  }, [])

  const isValidUrl = (url: string) => {
    try { new URL(url); return true } catch { return false }
  }

  // Check if post URL domain matches the cart domain
  const isPostDomainMatchingCartDomain = (): boolean => {
    if (!cartDomain || !formData.completeUrl.trim()) return true // Allow if no cart domain or no URL entered yet
    
    try {
      const url = new URL(formatUrl(formData.completeUrl))
      const postDomain = url.hostname.replace(/^www\./, '').toLowerCase()
      const cartDomainNormalized = cartDomain.replace(/^www\./, '').toLowerCase()
      
      return postDomain === cartDomainNormalized
    } catch {
      return false
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!formData.title.trim()) e.title = 'Title is required'
    
    // Check if completeUrl is provided and valid
    if (!formData.completeUrl.trim()) {
      e.completeUrl = 'Post URL is required'
    } else {
      // Test both the original URL and the formatted URL
      const formattedUrl = formatUrl(formData.completeUrl)
      console.log('Validating URL:', { original: formData.completeUrl, formatted: formattedUrl })
      if (!isValidUrl(formData.completeUrl) && !isValidUrl(formattedUrl)) {
        e.completeUrl = 'Valid Post URL required'
      }
    }
    
    // Check if we have at least one valid anchor pair
    const validPairs = formData.anchorPairs.filter(pair => pair.text.trim() && pair.link.trim())
    if (validPairs.length === 0) {
      e.anchorPairs = 'At least one anchor pair is required'
    } else {
      // Validate each valid pair
      validPairs.forEach((pair, index) => {
        if (!pair.text.trim()) e[`anchorText${index}`] = 'Anchor text required'
        if (!pair.link.trim() || !isValidUrl(pair.link)) e[`anchorUrl${index}`] = 'Valid anchor URL required'
      })
    }
    
    setErrors(e)
    console.log('Validation errors:', e)
    return Object.keys(e).length === 0
  }

  const formatUrl = (url: string): string => {
    if (!url.trim()) return ''
    
    // If URL already has protocol, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    
    // Add https:// protocol if missing
    return `https://${url}`
  }

  const setField = (key: keyof LinkInsertionAsPost, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const setAnchorPair = (idx: number, key: 'text' | 'link', value: string) => {
    setFormData(prev => {
      const next = [...prev.anchorPairs]
      next[idx] = { ...next[idx], [key]: value }
      return { ...prev, anchorPairs: next }
    })
  }

  const saveDraft = async () => {
    if (!validate()) {
      console.log('Validation failed, errors:', errors)
      return toast.error('Please fix errors')
    }
    
    // Check if post URL domain matches cart domain
    if (!isPostDomainMatchingCartDomain()) {
      return toast.error(`The post URL domain must match the selected website domain (${cartDomain}). Please enter the correct URL.`, {
        duration: 6000,
      })
    }
    
    // Ensure domain exists in available websites
    if (!isDomainAvailable()) {
      return toast.error('Selected domain is not available. Please choose a domain from the available websites.')
    }
    
    try {
      setSaving(true)
      const draftData = {
        title: formData.title,
        completeUrl: formatUrl(formData.completeUrl),
        content: formData.requirements || '', // Use requirements as content
        metaTitle: formData.metaTitle || '',
        metaDescription: formData.metaDescription || '',
        keywords: formData.keywords || '',
        anchorPairs: formData.anchorPairs.filter(pair => pair.text.trim() && pair.link.trim()),
        postType: 'link-insertion',
        status: 'draft'
      }
      console.log('Saving draft with data:', draftData)
      await apiService.savePostDraft(draftData)
      toast.success('Draft saved')
      router.push('/advertiser/project')
    } catch (e: any) {
      console.error('Save draft error:', e)
      toast.error(e?.message || 'Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  const submit = async () => {
    if (!validate()) {
      console.log('Validation failed, errors:', errors)
      return toast.error('Please fix errors')
    }
    
    // Check if post URL domain matches cart domain
    if (!isPostDomainMatchingCartDomain()) {
      return toast.error(`The post URL domain must match the selected website domain (${cartDomain}). Please enter the correct URL.`, {
        duration: 6000,
      })
    }
    
    // Ensure domain exists in available websites
    if (!isDomainAvailable()) {
      return toast.error('Selected domain is not available. Please choose a domain from the available websites.')
    }
    
    try {
      setSaving(true)
      const submitData = {
        title: formData.title,
        completeUrl: formatUrl(formData.completeUrl),
        content: formData.requirements || '', // Use requirements as content
        metaTitle: formData.metaTitle || '',
        metaDescription: formData.metaDescription || '',
        keywords: formData.keywords || '',
        anchorPairs: formData.anchorPairs.filter(pair => pair.text.trim() && pair.link.trim()),
        postType: 'link-insertion',
        status: 'pending'
      }
      
      console.log('Submitting Link Insertion post:', submitData)
      const response = await apiService.submitPost(submitData)
      const postId = (response.data as any)?.post?._id
      
      if (!postId) {
        toast.error('Failed to get post ID from response')
        return
      }
      
      // Find the website by domain to get websiteId and price
      const website = websites.find(w => {
        try {
          const url = new URL(formatUrl(formData.completeUrl))
          const domain = url.hostname.replace(/^www\./, '').toLowerCase()
          const websiteDomain = (w.domain || new URL(w.url).hostname).replace(/^www\./, '').toLowerCase()
          return websiteDomain === domain
        } catch {
          return false
        }
      })
      
      if (!website) {
        toast.error('Website not found for the selected domain')
        return
      }
      
      // Add the post to cart
      dispatch(addPostToCart({
        websiteId: website._id,
        domain: website.domain || new URL(website.url).hostname.replace('www.', ''),
        type: 'linkInsertion',
        price: website.pricing?.linkInsertion || 0,
        selectedPostId: postId
      }))
      
      toast.success('Link insertion submitted and added to cart')
      router.push('/advertiser/cart')
    } catch (e: any) {
      console.error('Submit error:', e)
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Link Insertion</h1>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
              <input 
                value={formData.title} 
                onChange={e => setField('title', e.target.value)} 
                className={`w-full px-3 py-2 rounded-xl border ${errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`} 
                placeholder="Enter link insertion title" 
              />
              {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Post URL</label>
              {cartDomain && (
                <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-medium">Expected domain:</span> {cartDomain}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    The post URL must be from this domain to match your cart selection.
                  </p>
                </div>
              )}
              <input value={formData.completeUrl} onChange={e => setField('completeUrl', e.target.value)} className={`w-full px-3 py-2 rounded-xl border ${errors.completeUrl ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`} placeholder="https://example.com/post" />
              {errors.completeUrl && <p className="text-sm text-red-600 mt-1">{errors.completeUrl}</p>}
              {cartDomain && formData.completeUrl && !isPostDomainMatchingCartDomain() && (
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                  ⚠️ The URL domain doesn't match the expected domain ({cartDomain})
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anchor Text</label>
                <input value={formData.anchorPairs[0].text} onChange={e => setAnchorPair(0, 'text', e.target.value)} className={`w-full px-3 py-2 rounded-xl border ${errors.anchorText ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`} placeholder="Click here" />
                {errors.anchorText && <p className="text-sm text-red-600 mt-1">{errors.anchorText}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anchor URL</label>
                <input value={formData.anchorPairs[0].link} onChange={e => setAnchorPair(0, 'link', e.target.value)} className={`w-full px-3 py-2 rounded-xl border ${errors.anchorUrl ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`} placeholder="https://target.com/page" />
                {errors.anchorUrl && <p className="text-sm text-red-600 mt-1">{errors.anchorUrl}</p>}
              </div>
            </div>
            {errors.anchorPairs && <p className="text-sm text-red-600 mt-1">{errors.anchorPairs}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Requirements (Optional)</label>
              <textarea 
                value={formData.requirements} 
                onChange={e => setField('requirements', e.target.value)} 
                rows={4} 
                placeholder="Describe any specific requirements, guidelines, or preferences for the link insertion..."
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" 
              />
            </div>

            <div className="flex gap-3">
              <button onClick={saveDraft} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white py-3 rounded-xl disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Draft'}</span>
              </button>
              <button onClick={submit} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
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


