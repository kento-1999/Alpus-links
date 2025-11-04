"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAppDispatch } from '@/hooks/redux'
import { addItem } from '@/store/slices/cartSlice'
import { addPostToCart } from '@/store/slices/cartSlice'
import { ArrowLeft, Save, Send, Link, Unlink, Image, Table, Minus, Play, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Quote, Bold, Italic, Strikethrough, Subscript, Superscript, Maximize2, Type, Palette, RotateCcw, RotateCw, HelpCircle, MoreHorizontal, Code, Eye, Plus } from 'lucide-react'
import CodeEditor from '@/components/editor/CodeEditor'
import RichTextEditor from '@/components/editor/RichTextEditor'
import { apiService } from '@/lib/api'
import toast from 'react-hot-toast'
import { ChevronDown, Search } from 'lucide-react'

interface AnchorPair {
  id: string
  text: string
  link: string
}

export default function EditPostPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const postId = (params?.id as string) || ''
  const dispatch = useAppDispatch()
  
  // Check if this is a view-only mode (from orders page)
  const isViewOnly = searchParams.get('viewOnly') === 'true'
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [postStatus, setPostStatus] = useState<string>('draft')
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    domain: '',
    slug: '',
    description: '',
    metaTitle: '',
    metaDescription: '',
    keywords: '',
    content: ''
  })
  const [domainError, setDomainError] = useState('')
  const [anchorPairs, setAnchorPairs] = useState<AnchorPair[]>([])
  const [extractedAnchorPairs, setExtractedAnchorPairs] = useState<AnchorPair[]>([])
  const [websites, setWebsites] = useState<any[]>([])
  const [showDomainDropdown, setShowDomainDropdown] = useState(false)
  const [domainSearchTerm, setDomainSearchTerm] = useState('')
  const [loadingWebsites, setLoadingWebsites] = useState(false)
  const [showFormatDropdown, setShowFormatDropdown] = useState(false)
  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false)
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual')
  const [showToolbar, setShowToolbar] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const editorRef = useRef<HTMLDivElement>(null)

  // Fetch websites for domain dropdown
  const fetchWebsites = async (searchTerm = '') => {
    try {
      setLoadingWebsites(true)
      const response = await apiService.getAdvertiserWebsites({
        page: 1,
        limit: 100, // Get more websites for better selection
        search: searchTerm
      })
      
      if ((response.data as any)?.websites) {
        setWebsites((response.data as any).websites)
      }
    } catch (error) {
      console.error('Error fetching websites:', error)
      toast.error('Failed to load websites')
    } finally {
      setLoadingWebsites(false)
    }
  }

  // Filter websites based on search term
  const filteredWebsites = websites.filter(website => {
    if (!domainSearchTerm.trim()) return true // Show all when search is empty
    return website.domain?.toLowerCase().includes(domainSearchTerm.toLowerCase()) ||
           website.url?.toLowerCase().includes(domainSearchTerm.toLowerCase())
  })

  useEffect(() => {
    const load = async () => {
      if (!postId) return
      try {
        setLoading(true)
        const { data } = await apiService.getPost(postId)
        const p = data?.post
        if (!p) throw new Error('Post not found')
        
        // Extract domain and slug from completeUrl or use separate fields
        let domain = p.domain || ''
        let slug = p.slug || ''
        
        console.log('Post data:', { completeUrl: p.completeUrl, domain: p.domain, slug: p.slug })
        
        if (p.completeUrl) {
          try {
            const urlObj = new URL(p.completeUrl.startsWith('http') ? p.completeUrl : `https://${p.completeUrl}`)
            domain = `${urlObj.protocol}//${urlObj.hostname}`
            slug = urlObj.pathname.replace(/^\//, '') || 'untitled'
            console.log('Parsed URL:', { domain, slug })
          } catch (e) {
            console.log('URL parsing failed, trying manual extraction')
            // If URL parsing fails, try to extract manually
            const parts = p.completeUrl.split('/')
            if (parts.length >= 3) {
              domain = `${parts[0]}//${parts[2]}`
              slug = parts.slice(3).join('/') || 'untitled'
            } else {
              // If it's not a complete URL, treat it as just a slug
              slug = p.completeUrl || 'untitled'
              domain = ''
            }
            console.log('Manual extraction:', { domain, slug })
          }
        }
        
        setFormData({
          title: p.title || '',
          domain: domain,
          slug: slug,
          description: p.description || '',
          metaTitle: p.metaTitle || '',
          metaDescription: p.metaDescription || '',
          keywords: p.keywords || '',
          content: p.content || ''
        })
        setPostStatus(p.status || 'draft')
        
        setAnchorPairs(Array.isArray(p.anchorPairs) ? p.anchorPairs.map((pair: any, index: number) => ({
          id: index.toString(),
          text: pair.text || '',
          link: pair.link || ''
        })) : [])
        
        // Extract anchor pairs from existing content
        if (p.content) {
          const extracted = extractAnchorPairsFromContent(p.content)
          setExtractedAnchorPairs(extracted)
        }
        
        updateWordCount(p.content || '')
        setInitialLoadComplete(true)
      } catch (e: any) {
        console.error(e)
        toast.error(e?.message || 'Failed to load post')
        router.push('/advertiser/project')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [postId, router])

  // Fetch websites on component mount
  useEffect(() => {
    fetchWebsites()
  }, [])

  // Initialize domain search term when component mounts
  useEffect(() => {
    if (formData.domain && !domainSearchTerm) {
      setDomainSearchTerm(formData.domain)
    }
  }, [formData.domain, domainSearchTerm])

  // Update domain search term when form data changes
  useEffect(() => {
    console.log('🔍 formData.domain changed to:', formData.domain)
    if (formData.domain) {
      setDomainSearchTerm(formData.domain)
    }
  }, [formData.domain])

  // Auto-generate slug from title
  useEffect(() => {
    if (formData.title && initialLoadComplete) {
      const newSlug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .trim()
      
      // Only update slug if it's empty or matches the old pattern
      if (!formData.slug || formData.slug === 'untitled' || formData.slug === '') {
        setFormData(prev => ({ ...prev, slug: newSlug }))
      }
    } else if (!formData.title && initialLoadComplete) {
      setFormData(prev => ({ ...prev, slug: '' }))
    }
  }, [formData.title, initialLoadComplete]) // Only re-run when title changes and after initial load

  // Ensure slug is properly formatted for backend validation
  const formatSlugForBackend = (slug: string): string => {
    return slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') // Only allow lowercase letters, numbers, and hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .trim() || 'untitled'
  }

  // Domain validation function
  const validateDomain = (domain: string): string => {
    if (!domain) return ''
    
    try {
      // Try to parse as URL, add protocol if missing
      const testUrl = domain.startsWith('http') ? domain : `https://${domain}`
      new URL(testUrl)
      return ''
    } catch {
      return 'Please enter a valid domain (e.g., https://example.com or example.com)'
    }
  }

  // Extract slug from complete URL
  const extractSlugFromUrl = (url: string): string => {
    if (!url) return 'untitled'
    
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      const pathname = urlObj.pathname
      // Remove leading slash and return the path
      const slug = pathname.replace(/^\//, '') || 'untitled'
      return formatSlugForBackend(slug)
    } catch {
      // If URL parsing fails, treat the whole string as slug
      const slug = url.replace(/^https?:\/\//, '').replace(/^[^\/]+\//, '') || 'untitled'
      return formatSlugForBackend(slug)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Validate domain when it changes
    if (field === 'domain') {
      const error = validateDomain(value)
      setDomainError(error)
    }
    
    // Auto-extract anchor pairs when content changes
    if (field === 'content') {
      const extracted = extractAnchorPairsFromContent(value)
      setExtractedAnchorPairs(extracted)
      
      // Also update anchorPairs to remove any pairs that are no longer in the content
      // This ensures consistency between manually added pairs and extracted pairs
      setAnchorPairs(prev => {
        return prev.filter(pair => {
          // Keep pairs that are still in the extracted content
          return extracted.some(extractedPair => 
            extractedPair.text === pair.text && extractedPair.link === pair.link
          )
        })
      })
    }
  }

  // Function to extract anchor text and links from HTML content
  const extractAnchorPairsFromContent = (content: string): AnchorPair[] => {
    if (!content) return []
    
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const links = doc.querySelectorAll('a[href]')
    
    const extractedPairs: AnchorPair[] = []
    
    links.forEach((link, index) => {
      const href = link.getAttribute('href')
      const text = link.textContent?.trim()
      
      if (href && text && href.startsWith('http')) {
        extractedPairs.push({
          id: `extracted-${Date.now()}-${index}`,
          text: text,
          link: href
        })
      }
    })
    
    return extractedPairs
  }

  const removeAnchorPair = (id: string) => {
    setAnchorPairs(prev => prev.filter(pair => pair.id !== id))
    setExtractedAnchorPairs(prev => prev.filter(pair => pair.id !== id))
  }

  const handleSaveDraft = async () => {
    try {
      setSaving(true)
      
      // Validate required fields before saving draft
      if (!formData.domain.trim()) {
        toast.error('Target Domain is required')
        setSaving(false)
        return
      }
      
      // Combine domain + slug into complete URL
      const completeUrl = formData.domain && formData.slug 
        ? `${formData.domain}/${formData.slug}`
        : formData.domain || formData.slug || ''
      
      // Use only extracted anchor pairs from content as the source of truth
      // This ensures that removed links are properly reflected in the update
      const validAnchorPairs = extractedAnchorPairs
        .filter(pair => pair.text.trim() && pair.link.trim())
        .map(pair => ({
          text: pair.text.trim(),
          link: pair.link.trim()
        }))
      
      // Remove duplicates based on text and link combination
      const uniqueAnchorPairs = validAnchorPairs.filter((pair, index, self) => 
        index === self.findIndex(p => p.text === pair.text && p.link === pair.link)
      )
      
      const payload = {
        title: formData.title,
        completeUrl: completeUrl,
        description: formData.description,
        metaTitle: formData.metaTitle,
        metaDescription: formData.metaDescription,
        keywords: formData.keywords,
        content: formData.content,
        anchorPairs: uniqueAnchorPairs,
        status: 'draft' // Ensure it stays as draft
      }
      console.log('Updating post with payload:', payload)
      await apiService.updatePost(postId, payload)
      toast.success('Post updated')
      router.push('/advertiser/project')
    } catch (e: any) {
      console.error('Post update error:', e)
      toast.error(e?.message || 'Failed to update post')
    } finally {
      setSaving(false)
    }
  }

  const handleSendToModeration = async () => {
    try {
      setSaving(true)
      // Combine domain + slug into complete URL
      const completeUrl = formData.domain && formData.slug 
        ? `${formData.domain}/${formData.slug}`
        : formData.domain || formData.slug || ''
      
      // Validate required fields before submission
      if (!formData.title.trim()) {
        toast.error('Title is required')
        return
      }
      if (!formData.domain.trim()) {
        toast.error('Target Domain is required')
        return
      }
      if (!completeUrl.trim()) {
        toast.error('Complete URL is required. Please enter both domain and slug.')
        return
      }
      if (!formData.content.trim()) {
        toast.error('Content is required')
        return
      }
      
      // Use only extracted anchor pairs from content as the source of truth
      // This ensures that removed links are properly reflected in the update
      const validAnchorPairs = extractedAnchorPairs
        .filter(pair => pair.text.trim() && pair.link.trim())
        .map(pair => ({
          text: pair.text.trim(),
          link: pair.link.trim()
        }))
      
      // Remove duplicates based on text and link combination
      const uniqueAnchorPairs = validAnchorPairs.filter((pair, index, self) => 
        index === self.findIndex(p => p.text === pair.text && p.link === pair.link)
      )
      
      const payload = {
        title: formData.title,
        completeUrl: completeUrl,
        description: formData.description,
        metaTitle: formData.metaTitle,
        metaDescription: formData.metaDescription,
        keywords: formData.keywords,
        content: formData.content,
        anchorPairs: uniqueAnchorPairs,
        status: 'pending' // Add status change to pending
      }
      
      console.log('Updating post with payload:', payload)
      console.log('Complete URL being sent:', completeUrl)
      console.log('Title being sent:', formData.title)
      console.log('Content being sent:', formData.content)
      
      const response = await apiService.updatePost(postId, payload)
      
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
        type: 'guestPost',
        price: website.pricing?.guestPost || 0,
        selectedPostId: postId
      }))
      
      toast.success('Post updated and added to cart')
      router.push('/advertiser/cart')
    } catch (e: any) {
      console.error('Post update error:', e)
      console.error('Error details:', e.response?.data || e.message)
      toast.error(e?.message || 'Failed to update post')
    } finally {
      setSaving(false)
    }
  }

  // Rich text editor functions (same as create page)
  const executeCommand = (command: string, value?: string) => {
    if (editorRef.current) {
      editorRef.current.focus()
      document.execCommand(command, false, value)
    }
  }

  const formatText = (format: string) => {
    if (!editorRef.current) return

    const editor = editorRef.current
    editor.focus()

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    
    if (selection.toString() === '') {
      let blockElement = range.commonAncestorContainer
      if (blockElement.nodeType === Node.TEXT_NODE) {
        blockElement = blockElement.parentElement!
      }
      
      while (blockElement && blockElement.nodeType === Node.ELEMENT_NODE && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV'].includes((blockElement as Element).tagName)) {
        blockElement = blockElement.parentElement!
      }
      
      if (blockElement) {
        range.selectNodeContents(blockElement)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }

    switch (format) {
      case 'bold':
        executeCommand('bold')
        break
      case 'italic':
        executeCommand('italic')
        break
      case 'underline':
        executeCommand('underline')
        break
      case 'heading1':
        wrapSelectionInTag('h1')
        break
      case 'heading2':
        wrapSelectionInTag('h2')
        break
      case 'normal':
        wrapSelectionInTag('p')
        break
    }
  }

  const wrapSelectionInTag = (tagName: string) => {
    if (!editorRef.current) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      const editor = editorRef.current
      const newElement = document.createElement(tagName)
      newElement.innerHTML = '&nbsp;'
      editor.appendChild(newElement)
      
      const range = document.createRange()
      range.selectNodeContents(newElement)
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
      
      const content = editor.innerHTML
      handleInputChange('content', content)
      updateWordCount(content)
      return
    }

    const range = selection.getRangeAt(0)
    const selectedText = selection.toString()
    
    if (selectedText) {
      const newElement = document.createElement(tagName)
      newElement.innerHTML = selectedText
      
      range.deleteContents()
      range.insertNode(newElement)
      
      selection.removeAllRanges()
    } else {
      const blockElement = range.commonAncestorContainer
      let elementToWrap = blockElement
      
      if (blockElement.nodeType === Node.TEXT_NODE) {
        elementToWrap = blockElement.parentElement!
      }
      
      while (elementToWrap && elementToWrap.nodeType === Node.ELEMENT_NODE && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV'].includes((elementToWrap as Element).tagName)) {
        elementToWrap = elementToWrap.parentElement!
      }
      
      if (elementToWrap && elementToWrap.nodeType === Node.ELEMENT_NODE && (elementToWrap as Element).tagName !== tagName.toUpperCase()) {
        const newElement = document.createElement(tagName)
        newElement.innerHTML = (elementToWrap as Element).innerHTML
        elementToWrap.parentNode?.replaceChild(newElement, elementToWrap)
      }
    }
    
    const content = editorRef.current?.innerHTML || ''
    handleInputChange('content', content)
    updateWordCount(content)
  }

  const insertImage = () => {
    const url = prompt('Enter image URL:')
    if (url) {
      executeCommand('insertImage', url)
    }
  }

  const insertCode = () => {
    executeCommand('insertHTML', '<code></code>')
  }

  const insertHorizontalRule = () => {
    executeCommand('insertHorizontalRule')
  }

  const insertReadMore = () => {
    executeCommand('insertHTML', '<!--more-->')
  }

  const insertSpecialChar = () => {
    const char = prompt('Enter special character:')
    if (char) {
      executeCommand('insertText', char)
    }
  }

  const clearFormatting = () => {
    executeCommand('removeFormat')
  }

  const indentText = () => {
    executeCommand('indent')
  }

  const outdentText = () => {
    executeCommand('outdent')
  }

  const undo = () => {
    executeCommand('undo')
  }

  const redo = () => {
    executeCommand('redo')
  }

  const changeTextColor = () => {
    const color = prompt('Enter color (e.g., #ff0000 or red):')
    if (color) {
      executeCommand('foreColor', color)
    }
  }

  const insertLink = () => {
    const url = prompt('Enter URL:')
    if (url) {
      executeCommand('createLink', url)
    }
  }

  const removeLink = () => {
    executeCommand('unlink')
  }

  const insertList = (ordered: boolean = false) => {
    if (ordered) {
      executeCommand('insertOrderedList')
    } else {
      executeCommand('insertUnorderedList')
    }
  }

  const insertBlockquote = () => {
    executeCommand('formatBlock', 'blockquote')
  }

  const alignText = (alignment: string) => {
    executeCommand('justify' + alignment.charAt(0).toUpperCase() + alignment.slice(1))
  }

  const insertTable = () => {
    const rows = prompt('Number of rows:', '2')
    const cols = prompt('Number of columns:', '2')
    if (rows && cols) {
      let table = '<table border="1">'
      for (let i = 0; i < parseInt(rows); i++) {
        table += '<tr>'
        for (let j = 0; j < parseInt(cols); j++) {
          table += '<td>&nbsp;</td>'
        }
        table += '</tr>'
      }
      table += '</table>'
      executeCommand('insertHTML', table)
    }
  }

  const updateWordCount = (content: string) => {
    const textContent = content.replace(/<[^>]*>/g, '').trim()
    const words = textContent.split(/\s+/).filter(word => word.length > 0)
    setWordCount(words.length)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showFormatDropdown) {
        setShowFormatDropdown(false)
      }
      if (showDomainDropdown) {
        setShowDomainDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFormatDropdown, showDomainDropdown])

  return (
    <ProtectedRoute allowedRoles={["advertiser"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  Edit Post
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Edit and update your guest post with professional editing tools
                </p>
              </div>
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

          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading post...</p>
            </div>
          ) : (
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
                          value={formData.title}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          placeholder="Type here your creative post name"
                          disabled={isViewOnly}
                          className={`w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300 text-lg font-semibold ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                        <span className="absolute right-4 top-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{formData.title.length}</span>
                      </div>
                    </div>

                    {/* Domain */}
                    <div className="mb-8">
                      <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                        <div className="w-3 h-3 bg-purple-500 rounded-full mr-4"></div>
                        Target Domain *
                      </label>
                      <div className="relative group">
                        <div className="relative">
                          <div className="relative">
                            <input
                              type="text"
                              value={formData.domain}
                              onChange={(e) => {
                                const value = e.target.value
                                console.log('🔍 Input onChange:', value)
                                setFormData(prev => ({ ...prev, domain: value }))
                                setDomainSearchTerm(value)
                                setShowDomainDropdown(true)
                              }}
                              onFocus={() => setShowDomainDropdown(true)}
                              onBlur={(e) => {
                                // Only close if the blur is not caused by clicking on dropdown items
                                const relatedTarget = e.relatedTarget as HTMLElement
                                if (!relatedTarget || !relatedTarget.closest('[data-domain-dropdown]')) {
                                  setTimeout(() => setShowDomainDropdown(false), 150)
                                }
                              }}
                              placeholder="Select a domain..."
                              disabled={isViewOnly}
                              className={`w-full px-4 py-3 pr-10 border-2 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 transition-all duration-300 text-lg font-mono ${
                                domainError 
                                  ? 'bg-white dark:bg-gray-800 border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-purple-500/20 focus:border-purple-500'
                              } ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowDomainDropdown(!showDomainDropdown)}
                              disabled={isViewOnly}
                              className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 ${isViewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <ChevronDown className={`w-5 h-5 transition-transform ${showDomainDropdown ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                          
                          {/* Dropdown Select */}
                          {showDomainDropdown && (
                            <div data-domain-dropdown className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto">
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
                                        console.log('🔍 Selecting domain:', domain)
                                        console.log('🔍 Current formData.domain before:', formData.domain)
                                        
                                        // Update form data with the selected domain
                                        setFormData(prev => {
                                          const newData = { ...prev, domain }
                                          console.log('🔍 New formData:', newData)
                                          return newData
                                        })
                                        
                                        // Update search term to match the selected domain
                                        setDomainSearchTerm(domain)
                                        
                                        // Close dropdown and clear any errors
                                        setShowDomainDropdown(false)
                                        setDomainError('')
                                        
                                        console.log('🔍 Domain selection completed')
                                      }}
                                      className={`w-full px-4 py-3 text-left hover:bg-purple-50 dark:hover:bg-purple-900/20 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                                        formData.domain === domain ? 'bg-purple-100 dark:bg-purple-900/30' : ''
                                      }`}
                                    >
                                      <div className="font-medium text-gray-900 dark:text-white">
                                        {domain}
                                      </div>
                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {website.url}
                                      </div>
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
                        <span className="absolute right-4 top-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{formData.domain.length}</span>
                      </div>
                      {domainError ? (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                          <span className="w-4 h-4 mr-2">⚠️</span>
                          {domainError}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          Enter the domain where you want to place your guest post (e.g., https://example.com).
                        </p>
                      )}
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
                          value={formData.slug}
                          onChange={(e) => {
                            const slug = e.target.value
                            handleInputChange('slug', slug)
                          }}
                          placeholder="your-article-slug"
                          disabled={isViewOnly}
                          className={`w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300 text-lg font-mono ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                        <span className="absolute right-4 top-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{formData.slug.length}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Auto-generated from title. Only lowercase letters, numbers, and hyphens allowed.
                      </p>
                      {formData.domain && formData.slug && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Complete URL Preview:</p>
                          <p className="text-lg font-mono text-gray-900 dark:text-white">
                            {formData.domain}/{formData.slug}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Description Editor */}
                    <div className="mb-8">
                      <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                        <div className="w-3 h-3 bg-cyan-500 rounded-full mr-4"></div>
                        Description *
                      </label>
                      <div className="border-2 border-gray-200 dark:border-gray-700 rounded-3xl overflow-hidden bg-white dark:bg-gray-800 shadow-xl hover:shadow-2xl transition-all duration-300">
                        {/* Editor Mode Tabs */}
                        <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {/* Editor Mode Tabs */}
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

                            {/* Fullscreen Toggle */}
                            <button
                              onClick={() => setIsFullscreen(!isFullscreen)}
                              className="p-3 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-gray-600 dark:text-gray-300 transition-all duration-200 hover:scale-110"
                              title="Toggle fullscreen"
                            >
                              <Maximize2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Content Area */}
                        <div className="relative">
                          {editorMode === 'visual' ? (
                            <RichTextEditor
                              value={formData.content}
                              onChange={(content) => {
                                handleInputChange('content', content)
                                updateWordCount(content)
                              }}
                              placeholder="Start writing your content here..."
                              height="450px"
                              readOnly={isViewOnly}
                            />
                          ) : (
                            <CodeEditor
                              value={formData.content}
                              onChange={(value) => {
                                handleInputChange('content', value)
                                updateWordCount(value)
                              }}
                              language="html"
                              height="450px"
                              placeholder="Start typing your HTML code here..."
                              readOnly={isViewOnly}
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
                            value={formData.metaTitle}
                            onChange={(e) => handleInputChange('metaTitle', e.target.value)}
                            placeholder="Type here your meta title"
                            disabled={isViewOnly}
                            className={`w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-300 text-lg font-semibold ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                          />
                          <span className="absolute right-4 top-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{formData.metaTitle.length}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                          <div className="w-3 h-3 bg-teal-500 rounded-full mr-4"></div>
                          Meta Description *
                        </label>
                        <div className="relative group">
                          <textarea
                            value={formData.metaDescription}
                            onChange={(e) => handleInputChange('metaDescription', e.target.value)}
                            placeholder="Briefly and succinctly describe what your post is about"
                            rows={4}
                            disabled={isViewOnly}
                            className={`w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-300 text-lg font-semibold resize-none ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                          />
                          <span className="absolute bottom-4 right-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{formData.metaDescription.length}</span>
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
                          value={formData.keywords}
                          onChange={(e) => handleInputChange('keywords', e.target.value)}
                          placeholder="Enter keywords separated by commas"
                          disabled={isViewOnly}
                          className={`w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-4 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all duration-300 text-lg font-semibold ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                        <span className="absolute right-4 top-4 text-sm text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-medium">{formData.keywords.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Anchor Text-Link Pairs */}
                  <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/40 dark:border-gray-700/60 overflow-hidden hover:shadow-3xl transition-all duration-300">
                    <div className="bg-green-500 px-4 py-3">
                      <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                        <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-bold">A</span>
                        </div>
                        <span>Anchor Text-Link Pairs</span>
                      </h2>
                    </div>
                    
                    <div className="p-4 space-y-4">
                      {extractedAnchorPairs.length > 0 ? (
                        <div className="space-y-4">
                          <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                            Extracted Pairs ({extractedAnchorPairs.length}):
                          </h4>
                          {extractedAnchorPairs.map((pair) => (
                            <div key={pair.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-lg hover:shadow-xl transition-all duration-300">
                              <div className="flex-1 min-w-0">
                                <div className="text-lg font-semibold text-gray-900 dark:text-white truncate mb-1">
                                  {pair.text}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 truncate font-mono">
                                  {pair.link}
                                </div>
                              </div>
                              <button
                                onClick={() => removeAnchorPair(pair.id)}
                                className="ml-4 p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200"
                                title="Remove this anchor pair"
                              >
                                <Unlink className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Link className="w-8 h-8 text-gray-400" />
                          </div>
                          <h4 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                            No Links Found
                          </h4>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {!isViewOnly && !(['request','inProgress','approved','rejected','completed'].includes(postStatus)) && (
                    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/30 dark:border-gray-700/50 overflow-hidden hover:shadow-3xl transition-all duration-300">
                      <div className="p-4 space-y-3">
                        <button
                          onClick={handleSaveDraft}
                          disabled={saving}
                          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50"
                        >
                          <Save className="w-5 h-5" />
                          <span>{saving ? 'Saving...' : 'Update Post'}</span>
                        </button>
                        <button
                          onClick={handleSendToModeration}
                          disabled={saving}
                          className="w-full bg-blue-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50"
                        >
                          <Send className="w-5 h-5" />
                          <span>Submit for Moderation</span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* View Only Notice */}
                  {isViewOnly && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                      <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
                        <Eye className="w-5 h-5" />
                        <span className="font-medium">View Only Mode</span>
                      </div>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        You are viewing this post from an order. Editing is disabled to prevent conflicts with ongoing work.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}


