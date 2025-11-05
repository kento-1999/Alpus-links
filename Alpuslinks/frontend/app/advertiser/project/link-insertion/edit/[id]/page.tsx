"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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

export default function EditLinkInsertionAsPostPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const postId = (params?.id as string) || ''
  const dispatch = useAppDispatch()
  
  // Check if this is a view-only mode (from orders page)
  const isViewOnly = searchParams.get('viewOnly') === 'true'
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [websites, setWebsites] = useState<any[]>([])
  const [orderStatus, setOrderStatus] = useState<string | null>(null)
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
  
  // Check if buttons should be hidden based on order status
  const shouldHideButtons = () => {
    if (isViewOnly) return true
    if (!orderStatus) return false
    // Hide buttons when order status is: requested, inProgress, rejected, or completed
    return ['requested', 'inProgress', 'rejected', 'completed'].includes(orderStatus)
  }

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

  // Fetch orders to check if this post is associated with any orders
  const fetchOrderStatus = async () => {
    try {
      // Fetch all advertiser orders to find orders associated with this post
      const response = await apiService.getAdvertiserOrders({})
      
      if ((response.data as any)?.success) {
        const orders = (response.data as any).data?.orders || []
        
        // Find orders where postId or linkInsertionId matches this post
        const relatedOrder = orders.find((order: any) => {
          const orderPostId = order.postId?._id || order.postId
          const orderLinkInsertionId = order.linkInsertionId?._id || order.linkInsertionId
          return orderPostId === postId || orderLinkInsertionId === postId
        })
        
        if (relatedOrder) {
          setOrderStatus(relatedOrder.status)
        }
      }
    } catch (error) {
      console.error('Error fetching order status:', error)
      // Don't show error to user, just silently fail
    }
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
        
        setFormData({
          title: post.title || '',
          completeUrl: post.completeUrl || '',
          requirements: post.content || '', // Load content as requirements
          metaTitle: post.metaTitle || '',
          metaDescription: post.metaDescription || '',
          keywords: post.keywords || '',
          anchorPairs: post.anchorPairs || [{ text: '', link: '' }]
        })
        
        // Check for associated orders after post is loaded
        await fetchOrderStatus()
      } catch (error: any) {
        console.error('Load error:', error)
        toast.error(error?.message || 'Failed to load post')
        router.push('/advertiser/project')
      } finally {
        setLoading(false)
      }
    }
    
    loadPost()
    fetchWebsites()
  }, [postId, router])

  const isValidUrl = (url: string) => {
    try { new URL(url); return true } catch { return false }
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
    
    const pair = formData.anchorPairs[0]
    if (!pair.text.trim()) e.anchorText = 'Anchor text required'
    if (!pair.link.trim() || !isValidUrl(pair.link)) e.anchorUrl = 'Valid anchor URL required'
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
    if (!validate()) return toast.error('Please fix errors')
    try {
      setSaving(true)
      await apiService.updatePost(postId, {
        title: formData.title,
        completeUrl: formatUrl(formData.completeUrl),
        content: formData.requirements || '', // Use requirements as content
        metaTitle: formData.metaTitle || '',
        metaDescription: formData.metaDescription || '',
        keywords: formData.keywords || '',
        anchorPairs: formData.anchorPairs,
        postType: 'link-insertion',
        status: 'draft'
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
    if (!validate()) return toast.error('Please fix errors')
    try {
      setSaving(true)
      const submitData = {
        title: formData.title,
        completeUrl: formatUrl(formData.completeUrl),
        content: formData.requirements || '', // Use requirements as content
        metaTitle: formData.metaTitle || '',
        metaDescription: formData.metaDescription || '',
        keywords: formData.keywords || '',
        anchorPairs: formData.anchorPairs,
        postType: 'link-insertion',
        status: 'pending'
      }
      
      console.log('Updating Link Insertion post:', submitData)
      await apiService.updatePost(postId, submitData)
      
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
      
      toast.success('Link insertion updated and added to cart')
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Link Insertion</h1>
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
              <input value={formData.completeUrl} onChange={e => setField('completeUrl', e.target.value)} className={`w-full px-3 py-2 rounded-xl border ${errors.completeUrl ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white`} placeholder="https://example.com/post" />
              {errors.completeUrl && <p className="text-sm text-red-600 mt-1">{errors.completeUrl}</p>}
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

            {!shouldHideButtons() && (
              <div className="flex gap-3">
                <button onClick={saveDraft} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white py-3 rounded-xl disabled:opacity-50 shadow-lg hover:shadow-xl transform transition-all duration-200">
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                </button>
                <button onClick={submit} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl disabled:opacity-50 shadow-lg hover:shadow-xl transform transition-all duration-200">
                  <Send className="w-4 h-4" />
                  <span>{saving ? 'Submitting...' : 'Send to Moderation'}</span>
                </button>
              </div>
            )}
            
            {/* View Only Notice */}
            {(isViewOnly || shouldHideButtons()) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
                  <Send className="w-5 h-5" />
                  <span className="font-medium">View Only Mode</span>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  {orderStatus 
                    ? `This link insertion is associated with an order that is ${orderStatus}. Editing is disabled to prevent conflicts with ongoing work.`
                    : 'You are viewing this link insertion from an order. Editing is disabled to prevent conflicts with ongoing work.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
