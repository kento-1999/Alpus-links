"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Eye, Code, Copy, Check, Send } from 'lucide-react'
import { apiService } from '@/lib/api'
import toast from 'react-hot-toast'
import RichTextEditor from '@/components/editor/RichTextEditor'
import CodeEditor from '@/components/editor/CodeEditor'

interface LinkInsertionData {
  title: string
  completeUrl: string
  requirements?: string
  metaTitle?: string
  metaDescription?: string
  keywords?: string
  anchorPairs: Array<{ text: string; link: string }>
}

interface GuestPostData {
  title: string
  domain: string
  slug: string
  description: string
  metaTitle?: string
  metaDescription?: string
  keywords?: string
  content: string
  anchorPairs?: Array<{ text: string; link: string }>
  requirements?: string
}

export default function PublisherOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = (params?.id as string) || ''
  
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<any>(null)
  const [linkInsertionData, setLinkInsertionData] = useState<LinkInsertionData | null>(null)
  const [guestPostData, setGuestPostData] = useState<GuestPostData | null>(null)
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual')
  const [wordCount, setWordCount] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [submittingApproval, setSubmittingApproval] = useState(false)

  // Copy to clipboard function with fallback
  const copyToClipboard = async (text: string, id: string) => {
    if (!text || text.trim() === '') {
      toast.error('Nothing to copy')
      return
    }

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        setCopiedId(id)
        toast.success('Copied to clipboard!')
        setTimeout(() => setCopiedId(null), 2000)
        return
      }

      // Fallback method for older browsers or non-secure contexts
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      try {
        const successful = document.execCommand('copy')
        if (successful) {
          setCopiedId(id)
          toast.success('Copied to clipboard!')
          setTimeout(() => setCopiedId(null), 2000)
        } else {
          throw new Error('execCommand failed')
        }
      } catch (err) {
        throw new Error('Fallback copy failed')
      } finally {
        document.body.removeChild(textArea)
      }
    } catch (error) {
      console.error('Copy error:', error)
      toast.error('Failed to copy to clipboard. Please try manually selecting and copying the text.')
    }
  }

  // Calculate word count
  const updateWordCount = (text: string) => {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0)
    setWordCount(words.length)
  }

  useEffect(() => {
    if (guestPostData?.content) {
      updateWordCount(guestPostData.content)
    }
  }, [guestPostData])

  // Load order and post data
  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        toast.error('Order ID is missing')
        router.push('/publisher/orders')
        return
      }
      
      try {
        setLoading(true)
        
        // Fetch order details
        const orderResponse = await apiService.getOrder(orderId)
        
        // Handle different response structures
        let orderData = null
        if ((orderResponse.data as any)?.data?.order) {
          orderData = (orderResponse.data as any).data.order
        } else if ((orderResponse.data as any)?.order) {
          orderData = (orderResponse.data as any).order
        } else if ((orderResponse.data as any)?.success && (orderResponse.data as any)?.data) {
          orderData = (orderResponse.data as any).data.order || (orderResponse.data as any).data
        }
        
        console.log('Order response:', orderResponse)
        console.log('Order data:', orderData)
        
        if (!orderData) {
          console.error('Order not found. Response:', orderResponse)
          toast.error('Order not found')
          router.push('/publisher/orders')
          return
        }
        
        setOrder(orderData)
        
        // For all order types, fetch the post data
        let post = null
        
        if (orderData.postId) {
          // Extract postId first (always fetch full post to ensure we get anchorPairs)
          let postId: string | null = null
          
          // Check if postId is already populated with post data
          if (orderData.postId && typeof orderData.postId === 'object' && 
              (orderData.postId.title !== undefined || orderData.postId._id !== undefined)) {
            // Get the post ID from populated object
            if (orderData.postId._id) {
              postId = typeof orderData.postId._id === 'string' 
                ? orderData.postId._id 
                : orderData.postId._id.toString()
            } else if (typeof orderData.postId === 'string') {
              postId = orderData.postId
            }
            
            // Check if populated data has all required fields
            const hasRequiredFields = orderData.postId.title && 
                                     (orderData.postId.content !== undefined) &&
                                     (orderData.postId.anchorPairs === undefined || Array.isArray(orderData.postId.anchorPairs))
            
            // Only fetch if we don't have all required fields
            // The backend now populates anchorPairs, content, title, etc. for writingGuestPost orders
            const needsFullFetch = !hasRequiredFields || 
                                   (orderData.type === 'writingGuestPost' && 
                                    (!orderData.postId.anchorPairs || !Array.isArray(orderData.postId.anchorPairs) ||
                                     !orderData.postId.content || !orderData.postId.title))
            
            if (!needsFullFetch && orderData.postId.title) {
              // Use populated data if all required fields are present
              post = orderData.postId
              console.log('Using populated post data:', {
                title: post.title,
                hasContent: !!post.content,
                hasAnchorPairs: !!post.anchorPairs,
                anchorPairs: post.anchorPairs
              })
            } else if (postId) {
              // Fetch full post data
              try {
                console.log('Fetching full post with ID:', postId, 'Reason: needsFullFetch=', needsFullFetch)
                const postResponse = await apiService.getPost(postId)
                console.log('Post response:', postResponse)
                
                // Handle different response structures
                if ((postResponse.data as any)?.post) {
                  post = (postResponse.data as any).post
                } else if ((postResponse.data as any)?.success && (postResponse.data as any)?.data) {
                  post = (postResponse.data as any).data.post || (postResponse.data as any).data
                } else if ((postResponse.data as any)?.data) {
                  post = (postResponse.data as any).data
                } else if ((postResponse.data as any)) {
                  post = (postResponse.data as any).post || (postResponse.data as any)
                }
                
                if (!post) {
                  console.warn('Post not found in response:', postResponse)
                  // Fallback to populated data if available
                  post = orderData.postId
                } else {
                  console.log('Fetched post successfully:', {
                    title: post.title,
                    content: post.content,
                    anchorPairs: post.anchorPairs,
                    hasTitle: !!post.title,
                    hasContent: !!post.content,
                    contentLength: post.content?.length || 0
                  })
                }
              } catch (error: any) {
                console.error('Error fetching post:', error)
                // Fallback to populated data if available
                if (orderData.postId && typeof orderData.postId === 'object' && orderData.postId.title) {
                  post = orderData.postId
                  console.log('Fell back to populated post data after fetch error')
                  // Don't show error toast if we have valid populated data to fall back to
                } else {
                  toast.error('Failed to load post details: ' + (error?.message || 'Unknown error'))
                }
              }
            } else {
              // Use populated data as fallback
              post = orderData.postId
              console.log('Using populated post data (no postId extracted):', post)
            }
          } else {
            // Extract postId and fetch it
            if (orderData.postId._id) {
              postId = typeof orderData.postId._id === 'string' 
                ? orderData.postId._id 
                : orderData.postId._id.toString()
            } else if (typeof orderData.postId === 'string') {
              postId = orderData.postId
            }
            
            if (postId) {
              try {
                console.log('Fetching post with ID:', postId)
                const postResponse = await apiService.getPost(postId)
                console.log('Post response:', postResponse)
                
                // Handle different response structures
                if ((postResponse.data as any)?.post) {
                  post = (postResponse.data as any).post
                } else if ((postResponse.data as any)?.success && (postResponse.data as any)?.data) {
                  post = (postResponse.data as any).data.post || (postResponse.data as any).data
                } else if ((postResponse.data as any)?.data) {
                  post = (postResponse.data as any).data
                } else if ((postResponse.data as any)) {
                  post = (postResponse.data as any).post || (postResponse.data as any)
                }
                
                if (!post) {
                  console.warn('Post not found in response:', postResponse)
                } else {
                  console.log('Fetched post successfully:', {
                    title: post.title,
                    content: post.content,
                    anchorPairs: post.anchorPairs,
                    hasTitle: !!post.title,
                    hasContent: !!post.content,
                    contentLength: post.content?.length || 0
                  })
                }
              } catch (error: any) {
                console.error('Error fetching post:', error)
                toast.error('Failed to load post details: ' + (error?.message || 'Unknown error'))
              }
            } else {
              console.warn('Could not extract postId from orderData.postId:', orderData.postId)
            }
          }
        } else {
          console.warn('Order does not have a postId:', orderData)
        }
        
        console.log('Final post data:', post)
        
        // Process post data if available
        if (post) {
          // Handle link insertion orders
          if (orderData.type === 'linkInsertion') {
            setLinkInsertionData({
              title: post.title || '',
              completeUrl: post.completeUrl || '',
              requirements: post.content || '',
              metaTitle: post.metaTitle || '',
              metaDescription: post.metaDescription || '',
              keywords: post.keywords || '',
              anchorPairs: post.anchorPairs || []
            })
          } 
          // Handle guest post orders and writing guest post orders
          else if (orderData.type === 'guestPost' || orderData.type === 'writingGuestPost') {
            // Extract domain and slug from completeUrl
            // Note: backend populates specific fields, so domain/slug may not be in post object
            let domain = post.domain || ''
            let slug = post.slug || ''
            
            // Try to extract from completeUrl (which is populated by backend)
            if (post.completeUrl) {
              try {
                const urlObj = new URL(post.completeUrl.startsWith('http') ? post.completeUrl : `https://${post.completeUrl}`)
                domain = `${urlObj.protocol}//${urlObj.hostname}`
                slug = urlObj.pathname.replace(/^\//, '') || 'untitled'
              } catch (e) {
                // Fallback parsing
                const parts = post.completeUrl.split('/')
                if (parts.length >= 3) {
                  domain = `${parts[0]}//${parts[2]}`
                  slug = parts.slice(3).join('/') || 'untitled'
                } else {
                  slug = post.completeUrl || 'untitled'
                  domain = ''
                }
              }
            } else if (orderData.websiteId?.domain || orderData.websiteId?.url) {
              // Fallback to order's website domain if completeUrl is not available
              domain = orderData.websiteId.domain || orderData.websiteId.url || ''
              slug = ''
            }
            
            // For writing + GP, content field contains requirements
            // For regular guest posts, content contains article content
            const isWritingGP = orderData.type === 'writingGuestPost'
            
            // Ensure anchorPairs is properly formatted
            let anchorPairs: Array<{ text: string; link: string }> = []
            if (post.anchorPairs) {
              if (Array.isArray(post.anchorPairs)) {
                // Filter out invalid pairs and ensure structure
                anchorPairs = post.anchorPairs
                  .filter((pair: any) => pair && (pair.text || pair.link))
                  .map((pair: any) => ({
                    text: pair.text || '',
                    link: pair.link || ''
                  }))
              } else if (typeof post.anchorPairs === 'object') {
                // Handle case where anchorPairs might be an object
                anchorPairs = Object.values(post.anchorPairs)
                  .filter((pair: any) => pair && (pair.text || pair.link))
                  .map((pair: any) => ({
                    text: pair.text || '',
                    link: pair.link || ''
                  }))
              }
            }
            console.log('Raw post.anchorPairs:', post.anchorPairs)
            console.log('Processed anchorPairs:', anchorPairs)
            
            console.log('Post data:', post)
            console.log('Post title:', post.title)
            console.log('Post content:', post.content)
            console.log('Post anchorPairs:', post.anchorPairs)
            console.log('Processed anchorPairs:', anchorPairs)
            console.log('Order type:', orderData.type)
            console.log('Is Writing GP:', isWritingGP)
            
            // Extract title and requirements properly
            const postTitle = post.title || ''
            const postContent = post.content || ''
            const requirements = isWritingGP ? postContent : undefined
            
            console.log('Extracted title:', postTitle)
            console.log('Extracted requirements:', requirements)
            
            const guestPostDataToSet = {
              title: postTitle,
              domain: domain,
              slug: slug,
              description: post.description || '',
              metaTitle: post.metaTitle || '',
              metaDescription: post.metaDescription || '',
              keywords: post.keywords || '',
              content: isWritingGP ? '' : postContent, // Article content (empty for writing + GP initially)
              anchorPairs: anchorPairs,
              requirements: requirements // Requirements for writing + GP
            }
            
            console.log('Setting guest post data:', guestPostDataToSet)
            console.log('Guest post data requirements:', guestPostDataToSet.requirements)
            setGuestPostData(guestPostDataToSet)
          }
        } else {
          // If no post data is available, show a message but don't keep loading forever
          console.warn('No post data available for order. Order type:', orderData.type)
          console.warn('Order data:', orderData)
          if (orderData.type === 'guestPost' || orderData.type === 'writingGuestPost') {
            // Try to get title and content from order notes or other fields
            const fallbackTitle = orderData.notes || orderData.postId?.title || 'Post information not available'
            const fallbackRequirements = orderData.type === 'writingGuestPost' 
              ? (orderData.notes || orderData.postId?.content || '') 
              : undefined
            
            console.log('Setting fallback data - title:', fallbackTitle, 'requirements:', fallbackRequirements)
            
            // Set minimal data to prevent infinite loading
            setGuestPostData({
              title: fallbackTitle,
              domain: orderData.websiteId?.domain || orderData.websiteId?.url || '',
              slug: '',
              description: '',
              content: '',
              anchorPairs: [],
              requirements: fallbackRequirements
            })
          }
        }
        
      } catch (error: any) {
        console.error('Load error:', error)
        toast.error(error?.message || 'Failed to load order')
        // Don't redirect immediately - let user see what's available
      } finally {
        setLoading(false)
      }
    }
    
    loadOrder()
  }, [orderId, router])

  // Handle sending order for approval
  const handleForApproval = async () => {
    if (!orderId) return
    
    try {
      setSubmittingApproval(true)
      const response = await apiService.updateOrderStatus(orderId, 'advertiserApproval', 'Order sent for advertiser approval')
      
      if ((response.data as any)?.success) {
        toast.success('Order sent for approval successfully')
        // Reload order data to reflect the status change
        const orderResponse = await apiService.getOrder(orderId)
        
        let orderData = null
        if ((orderResponse.data as any)?.data?.order) {
          orderData = (orderResponse.data as any).data.order
        } else if ((orderResponse.data as any)?.order) {
          orderData = (orderResponse.data as any).order
        } else if ((orderResponse.data as any)?.success && (orderResponse.data as any)?.data) {
          orderData = (orderResponse.data as any).data.order || (orderResponse.data as any).data
        }
        
        if (orderData) {
          setOrder(orderData)
        }
      } else {
        throw new Error((response.data as any)?.message || 'Failed to send order for approval')
      }
    } catch (error: any) {
      console.error('Error sending for approval:', error)
      toast.error(error?.message || 'Failed to send order for approval')
    } finally {
      setSubmittingApproval(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["publisher"]}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-4">Loading order details...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!order) {
    return (
      <ProtectedRoute allowedRoles={["publisher"]}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center space-x-3 mb-8">
              <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Order Detail</h1>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-6">
              <p className="text-gray-600 dark:text-gray-400">Order not found.</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // Show loading state if data is still being fetched
  if (order.type === 'linkInsertion' && !linkInsertionData) {
    return (
      <ProtectedRoute allowedRoles={["publisher"]}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center space-x-3 mb-8">
              <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Order Detail</h1>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-6">
              <p className="text-gray-600 dark:text-gray-400">Loading link insertion details...</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if ((order.type === 'guestPost' || order.type === 'writingGuestPost') && !guestPostData) {
    return (
      <ProtectedRoute allowedRoles={["publisher"]}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center space-x-3 mb-8">
              <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Order Detail</h1>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-6">
              <p className="text-gray-600 dark:text-gray-400">Loading guest post details...</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const displayData = (order?.type === 'guestPost' || order?.type === 'writingGuestPost') ? guestPostData : linkInsertionData

  return (
    <ProtectedRoute allowedRoles={["publisher"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8">
          {/* Header - Simple for Writing + GP, Complex for Guest Post */}
          {order?.type === 'writingGuestPost' ? (
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Order Detail</h1>
              </div>
              {order?.status === 'inProgress' && (
                <button
                  onClick={handleForApproval}
                  disabled={submittingApproval}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>{submittingApproval ? 'Sending...' : 'For Approval'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="mb-10">
              <div className="flex items-center space-x-4 mb-6">
                <button
                  onClick={() => router.back()}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-200"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Order Detail
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    {order?.type === 'guestPost' ? 'View guest post details' : 'View link insertion details'}
                  </p>
                </div>
                {order?.status === 'inProgress' && (
                  <button
                    onClick={handleForApproval}
                    disabled={submittingApproval}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submittingApproval ? 'Sending...' : 'For Approval'}</span>
                  </button>
                )}
              </div>
              
              {/* Progress Indicator */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Content</span>
                </div>
                <div className="w-8 h-px bg-gray-300 dark:bg-gray-600"></div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">SEO</span>
                </div>
                <div className="w-8 h-px bg-gray-300 dark:bg-gray-600"></div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Publish</span>
                </div>
              </div>
            </div>
          )}

          {/* Writing + GP Display - Simple Layout */}
          {order?.type === 'writingGuestPost' && guestPostData && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
                <div className="relative">
                  <input 
                    value={guestPostData.title || ''} 
                    readOnly
                    disabled
                    placeholder="Title will appear here..."
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white opacity-60 cursor-not-allowed" 
                  />
                  <button
                    onClick={() => copyToClipboard(guestPostData.title || '', 'writing-gp-title')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedId === 'writing-gp-title' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
                {!guestPostData.title && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No title available</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Domain</label>
                <div className="relative">
                  <input
                    type="text"
                    value={guestPostData.domain || ''}
                    readOnly
                    disabled
                    placeholder="Domain will appear here..."
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white opacity-60 cursor-not-allowed"
                  />
                  <button
                    onClick={() => copyToClipboard(guestPostData.domain || '', 'writing-gp-domain')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedId === 'writing-gp-domain' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Requirements</label>
                <textarea 
                  value={guestPostData.requirements || ''} 
                  readOnly
                  disabled
                  rows={8} 
                  placeholder="Requirements will appear here..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white opacity-60 cursor-not-allowed resize-none" 
                />
                {!guestPostData.requirements && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No requirements available</p>
                )}
              </div>

              {/* Anchor Pairs - Always show, matching advertiser edit page */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Anchor Pairs</label>
                </div>
                
                {!guestPostData.anchorPairs || guestPostData.anchorPairs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <p>No anchor pairs added yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {guestPostData.anchorPairs.map((pair, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anchor Text</label>
                          <div className="relative">
                            <input 
                              value={pair.text || ''} 
                              readOnly
                              disabled
                              placeholder="Enter anchor text..."
                              className="w-full px-3 py-2 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white opacity-60 cursor-not-allowed" 
                            />
                            <button
                              onClick={() => copyToClipboard(pair.text || '', `writing-gp-anchor-text-${index}`)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title="Copy to clipboard"
                            >
                              {copiedId === `writing-gp-anchor-text-${index}` ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-500" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anchor Link</label>
                          <div className="relative">
                            <input 
                              value={pair.link || ''} 
                              readOnly
                              disabled
                              placeholder="Enter anchor link..."
                              className="w-full px-3 py-2 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white opacity-60 cursor-not-allowed break-all" 
                            />
                            <button
                              onClick={() => copyToClipboard(pair.link || '', `writing-gp-anchor-link-${index}`)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title="Copy to clipboard"
                            >
                              {copiedId === `writing-gp-anchor-link-${index}` ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-500" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Guest Post Display (Regular) */}
          {order?.type === 'guestPost' && guestPostData && (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              {/* Main Content Editor */}
              <div className="xl:col-span-3">
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/30 dark:border-gray-700/50 overflow-hidden hover:shadow-3xl transition-all duration-300">
                  <div className="p-8">
                    {/* Article Title */}
                    <div className="mb-8">
                      <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-4"></div>
                        Article Title *
                      </label>
                      <div className="relative group">
                        <input
                          type="text"
                          value={guestPostData.title || ''}
                          readOnly
                          disabled
                          className="w-full px-4 py-3 pr-20 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 text-lg font-semibold opacity-60 cursor-not-allowed"
                        />
                        <button
                          onClick={() => copyToClipboard(guestPostData.title || '', 'guest-post-title')}
                          className="absolute right-12 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === 'guest-post-title' ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        <span className="absolute right-4 top-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{(guestPostData.title || '').length}</span>
                      </div>
                    </div>

                    {/* Domain */}
                    <div className="mb-8">
                      <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                        <div className="w-3 h-3 bg-purple-500 rounded-full mr-4"></div>
                        Target Domain *
                      </label>
                      <div className="relative group">
                        <input
                          type="text"
                          value={guestPostData.domain || ''}
                          readOnly
                          disabled
                          className="w-full px-4 py-3 pr-20 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 text-lg font-mono opacity-60 cursor-not-allowed"
                        />
                        <button
                          onClick={() => copyToClipboard(guestPostData.domain || '', 'guest-post-domain')}
                          className="absolute right-12 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === 'guest-post-domain' ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        <span className="absolute right-4 top-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{(guestPostData.domain || '').length}</span>
                      </div>
                    </div>

                    {/* URL Slug */}
                    <div className="mb-8">
                      <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-4"></div>
                        URL Slug *
                      </label>
                      <div className="relative group">
                        <input
                          type="text"
                          value={guestPostData.slug || ''}
                          readOnly
                          disabled
                          className="w-full px-4 py-3 pr-20 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 text-lg font-mono opacity-60 cursor-not-allowed"
                        />
                        <button
                          onClick={() => copyToClipboard(guestPostData.slug || '', 'guest-post-slug')}
                          className="absolute right-12 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === 'guest-post-slug' ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        <span className="absolute right-4 top-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{(guestPostData.slug || '').length}</span>
                      </div>
                      {guestPostData.domain && guestPostData.slug && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Complete URL Preview:</p>
                          <p className="text-lg font-mono text-gray-900 dark:text-white">
                            {guestPostData.domain}/{guestPostData.slug}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Description/Content Editor */}
                    <div className="mb-8">
                      <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                        <div className="w-3 h-3 bg-cyan-500 rounded-full mr-4"></div>
                        Content *
                      </label>
                      <div className="border-2 border-gray-200 dark:border-gray-700 rounded-3xl overflow-hidden bg-white dark:bg-gray-800 shadow-xl hover:shadow-2xl transition-all duration-300">
                        {/* Editor Mode Tabs */}
                        <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex bg-white dark:bg-gray-800 rounded-xl p-1 shadow-lg">
                                <button
                                  onClick={() => setEditorMode('visual')}
                                  className={`flex items-center space-x-3 px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-300 ${
                                    editorMode === 'visual' 
                                      ? 'bg-blue-600 text-white shadow-lg transform scale-105' 
                                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  <Eye className="w-5 h-5" />
                                  <span>Visual</span>
                                </button>
                                <button
                                  onClick={() => setEditorMode('html')}
                                  className={`flex items-center space-x-3 px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-300 ${
                                    editorMode === 'html' 
                                      ? 'bg-blue-600 text-white shadow-lg transform scale-105' 
                                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  <Code className="w-5 h-5" />
                                  <span>HTML</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Content Area */}
                        <div className="relative">
                          {editorMode === 'visual' ? (
                            <RichTextEditor
                              value={guestPostData.content || ''}
                              onChange={() => {}}
                              placeholder="Content will appear here..."
                              height="450px"
                              readOnly={true}
                            />
                          ) : (
                            <CodeEditor
                              value={guestPostData.content || ''}
                              onChange={() => {}}
                              language="html"
                              height="450px"
                              placeholder="HTML content will appear here..."
                              readOnly={true}
                            />
                          )}
                        </div>
                        
                        {/* Word Count */}
                        <div className="mt-4 flex justify-between items-center px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                            Word count: <span className="text-blue-600 dark:text-blue-400 font-semibold">{wordCount}</span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {wordCount < 300 ? 'Minimum 300 words recommended' : wordCount > 2000 ? 'Consider breaking into multiple posts' : 'Good length for SEO'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar with Meta Information */}
              <div className="xl:col-span-1">
                <div className="space-y-8">
                  {/* Meta-tags Section */}
                  <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/30 dark:border-gray-700/50 overflow-hidden hover:shadow-3xl transition-all duration-300">
                    <div className="bg-blue-600 px-4 py-3">
                      <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-bold">M</span>
                        </div>
                        <span>Meta-tags</span>
                        <div className="w-4 h-4 bg-white/20 rounded-full flex items-center justify-center ml-auto">
                          <span className="text-xs text-white font-bold">i</span>
                        </div>
                      </h2>
                    </div>
                    
                    <div className="p-4 space-y-6">
                      <div>
                        <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                          <div className="w-3 h-3 bg-orange-500 rounded-full mr-4"></div>
                          Meta Title *
                        </label>
                        <div className="relative group">
                          <input
                            type="text"
                            value={guestPostData.metaTitle || ''}
                            readOnly
                            disabled
                            className="w-full px-4 py-3 pr-20 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 text-lg font-semibold opacity-60 cursor-not-allowed"
                          />
                          <button
                            onClick={() => copyToClipboard(guestPostData.metaTitle || '', 'guest-post-meta-title')}
                            className="absolute right-12 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedId === 'guest-post-meta-title' ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                          <span className="absolute right-4 top-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{(guestPostData.metaTitle || '').length}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                          <div className="w-3 h-3 bg-teal-500 rounded-full mr-4"></div>
                          Meta Description *
                        </label>
                        <div className="relative group">
                          <textarea
                            value={guestPostData.metaDescription || ''}
                            readOnly
                            disabled
                            rows={4}
                            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 text-lg font-semibold resize-none opacity-60 cursor-not-allowed"
                          />
                          <span className="absolute bottom-4 right-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{(guestPostData.metaDescription || '').length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Keywords Section */}
                  <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/40 dark:border-gray-700/60 overflow-hidden hover:shadow-3xl transition-all duration-300">
                    <div className="bg-yellow-500 px-4 py-3">
                      <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-bold">K</span>
                        </div>
                        <span>Keywords</span>
                      </h2>
                    </div>
                    <div className="p-4">
                      <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-4"></div>
                        Keywords *
                      </label>
                      <div className="relative group">
                        <input
                          type="text"
                          value={guestPostData.keywords || ''}
                          readOnly
                          disabled
                          className="w-full px-4 py-3 pr-20 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 text-lg font-semibold opacity-60 cursor-not-allowed"
                        />
                        <button
                          onClick={() => copyToClipboard(guestPostData.keywords || '', 'guest-post-keywords')}
                          className="absolute right-12 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === 'guest-post-keywords' ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        <span className="absolute right-4 top-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{(guestPostData.keywords || '').length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Anchor Pairs Section for Writing + GP */}
                  {order?.type === 'writingGuestPost' && guestPostData.anchorPairs && guestPostData.anchorPairs.length > 0 && (
                    <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/40 dark:border-gray-700/60 overflow-hidden hover:shadow-3xl transition-all duration-300">
                      <div className="bg-purple-500 px-4 py-3">
                        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                          <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                            <span className="text-xs font-bold">A</span>
                          </div>
                          <span>Anchor Pairs</span>
                        </h2>
                      </div>
                      <div className="p-4 space-y-4">
                        {guestPostData.anchorPairs.map((pair, index) => (
                          <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                            <div className="mb-3">
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Anchor Text {index + 1}
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={pair.text || ''}
                                  readOnly
                                  disabled
                                  className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white opacity-60 cursor-not-allowed"
                                />
                                <button
                                  onClick={() => copyToClipboard(pair.text || '', `guest-post-anchor-text-${index}`)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Copy to clipboard"
                                >
                                  {copiedId === `guest-post-anchor-text-${index}` ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Copy className="w-4 h-4 text-gray-500" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Anchor URL {index + 1}
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={pair.link || ''}
                                  readOnly
                                  disabled
                                  className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white opacity-60 cursor-not-allowed break-all"
                                />
                                <button
                                  onClick={() => copyToClipboard(pair.link || '', `guest-post-anchor-link-${index}`)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Copy to clipboard"
                                >
                                  {copiedId === `guest-post-anchor-link-${index}` ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Copy className="w-4 h-4 text-gray-500" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Requirements Section for Writing + GP */}
                  {order?.type === 'writingGuestPost' && guestPostData.requirements && (
                    <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/40 dark:border-gray-700/60 overflow-hidden hover:shadow-3xl transition-all duration-300">
                      <div className="bg-indigo-500 px-4 py-3">
                        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                          <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                            <span className="text-xs font-bold">R</span>
                          </div>
                          <span>Requirements</span>
                        </h2>
                      </div>
                      <div className="p-4">
                        <textarea
                          value={guestPostData.requirements || ''}
                          readOnly
                          disabled
                          rows={6}
                          className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 text-lg resize-none opacity-60 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Link Insertion Display - keeping simpler for now */}
          {order?.type === 'linkInsertion' && linkInsertionData && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
                <div className="relative">
                  <input
                    type="text"
                    value={linkInsertionData.title || ''}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed opacity-100"
                  />
                  <button
                    onClick={() => copyToClipboard(linkInsertionData.title || '', 'link-insertion-title')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedId === 'link-insertion-title' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Post URL</label>
                <div className="relative">
                  <input
                    type="text"
                    value={linkInsertionData.completeUrl || ''}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed opacity-100"
                  />
                  <button
                    onClick={() => copyToClipboard(linkInsertionData.completeUrl || '', 'link-insertion-url')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedId === 'link-insertion-url' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anchor Text</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={linkInsertionData.anchorPairs[0]?.text || ''}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed opacity-100"
                    />
                    <button
                      onClick={() => copyToClipboard(linkInsertionData.anchorPairs[0]?.text || '', 'link-insertion-anchor-text')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedId === 'link-insertion-anchor-text' ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anchor URL</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={linkInsertionData.anchorPairs[0]?.link || ''}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed opacity-100 break-all"
                    />
                    <button
                      onClick={() => copyToClipboard(linkInsertionData.anchorPairs[0]?.link || '', 'link-insertion-anchor-link')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedId === 'link-insertion-anchor-link' ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Requirements (Optional)</label>
                <textarea
                  value={linkInsertionData.requirements || ''}
                  readOnly
                  disabled
                  rows={4}
                  placeholder="Describe any specific requirements, guidelines, or preferences for the link insertion..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed opacity-100 resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
