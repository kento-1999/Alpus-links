const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === '192.168.138.120' || window.location.hostname === 'alpuslinks.net')
    ? 'http://192.168.138.120:5000/api' 
    : process.env.NODE_ENV === 'production' 
      ? 'https://your-backend-api-url.com/api'  // Replace with your actual backend URL
      : 'http://localhost:5000/api')

interface ApiResponse<T> {
  data?: T
  message?: string
  errors?: any[]
}

class ApiService {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  // Expose read-only access for diagnostics/logging
  public getBaseURL(): string {
    return this.baseURL
  }

  // Utility method to check if token is expired
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Date.now() / 1000
      return payload.exp < currentTime
    } catch {
      return true
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`
    console.log('🌍 Full URL:', url)
    let token = localStorage.getItem('auth_token')

    // Check if token is expired before making the request
    if (token && this.isTokenExpired(token)) {
      console.log('Token is expired, attempting to refresh...')
      try {
        const refreshUrl = `${this.baseURL}/auth/refresh`
        const refreshResponse = await fetch(refreshUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          token = refreshData.token
          if (token) {
            localStorage.setItem('auth_token', token)
            console.log('Token refreshed proactively')
          }
        } else {
          // If refresh fails, clear the token
          localStorage.removeItem('auth_token')
          token = null
        }
      } catch (error) {
        console.log('Proactive token refresh failed:', error)
        localStorage.removeItem('auth_token')
        token = null
      }
    }

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        console.error('API Error:', {
          status: response.status,
          statusText: response.statusText,
          data
        })
        
        // Handle token expiration specifically
        if (response.status === 401 && data.code === 'TOKEN_EXPIRED') {
          console.log('Token expired, attempting to refresh...')
          
          // Try to refresh the token first
          try {
            const refreshUrl = `${this.baseURL}/auth/refresh`
            const refreshResponse = await fetch(refreshUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
              },
            })
            
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              const { token: newToken } = refreshData
              if (newToken) {
                localStorage.setItem('auth_token', newToken)
                console.log('Token refreshed successfully, retrying original request')
              }
              
              // Retry the original request with the new token
              const retryConfig = {
                ...config,
                headers: {
                  ...config.headers,
                  Authorization: `Bearer ${newToken}`
                }
              }
              
              const retryResponse = await fetch(url, retryConfig)
              const retryData = await retryResponse.json()
              
              if (retryResponse.ok) {
                return { data: retryData }
              }
            }
          } catch (refreshError) {
            console.log('Token refresh failed:', refreshError)
          }
          
          // If refresh failed, clear token and dispatch event
          localStorage.removeItem('auth_token')
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tokenExpired', { 
              detail: { message: data.message, code: data.code } 
            }))
          }
        }
        
        throw new Error(data.message || `Request failed with status ${response.status}`)
      }

      return { data }
    } catch (error) {
      console.error('API request failed:', error)
      // If it's a 401 error, clear the token and dispatch event
      if (error instanceof Error && error.message.includes('401')) {
        localStorage.removeItem('auth_token')
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tokenExpired', { 
            detail: { message: 'Authentication failed', code: 'AUTH_FAILED' } 
          }))
        }
      }
      throw error
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async register(userData: {
    firstName: string
    lastName: string
    email: string
    password: string
    role: string
    verificationCode?: string
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  async refreshToken() {
    return this.request('/auth/refresh', {
      method: 'POST',
    })
  }

  async updateUser(userId: string, payload: any) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async getUser(userId: string) {
    return this.request(`/users/${userId}`)
  }

  async getUserById(userId: string) {
    return this.request(`/users/${userId}`)
  }

  // User Meta endpoints
  async getUserMeta() {
    return this.request('/user-meta')
  }

  async getUserMetaById(userId: string) {
    return this.request(`/user-meta/by-user/${userId}`)
  }

  async updateUserMeta(payload: {
    phone?: string
    location?: string
    bio?: string
    website?: string
    country?: string
    language?: string
    socialLinks?: {
      twitter?: string
      linkedin?: string
      github?: string
    }
  }) {
    return this.request('/user-meta', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async updateUserMetaById(userId: string, payload: {
    phone?: string
    location?: string
    bio?: string
    website?: string
    country?: string
    language?: string
    timezone?: string
    socialLinks?: {
      twitter?: string
      linkedin?: string
      github?: string
    }
  }) {
    return this.request(`/user-meta/by-user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  // User management endpoints
  async getUsers(page = 1, limit = 10, search = '', role = '', status = '') {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
      ...(role && { role }),
      ...(status && { status })
    })
    return this.request(`/users?${params}`)
  }

  async createUser(userData: {
    firstName: string
    lastName: string
    email: string
    password: string
    role: string
    phone?: string
    location?: string
  }) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async deleteUser(userId: string) {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    })
  }

  async forceUserOnline(userId: string) {
    return this.request(`/users/force-online/${userId}`, {
      method: 'POST',
    })
  }

  async createSession() {
    return this.request('/users/create-session', {
      method: 'POST',
    })
  }

  async forceUserLogout(userId: string) {
    return this.request(`/users/force-logout/${userId}`, {
      method: 'POST',
    })
  }

  async debugUserSessions(email: string) {
    return this.request(`/users/debug-sessions/${email}`, {
      method: 'GET',
    })
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    })
  }

  // Get available roles for registration
  async getRoles() {
    return this.request('/roles/public')
  }

  // Google OAuth login
  async googleLogin(token: string) {
    return this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  }

  // 2FA endpoints
  async sendTwoFactorCode(email: string, purpose: 'login' | 'register' | 'password_reset' = 'login') {
    return this.request('/auth/send-2fa-code', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    })
  }

  async verifyTwoFactorCode(email: string, code: string, purpose: 'login' | 'register' | 'password_reset' = 'login') {
    return this.request('/auth/verify-2fa-code', {
      method: 'POST',
      body: JSON.stringify({ email, code, purpose }),
    })
  }

  // Switch user role
  async switchRole(targetRole: 'publisher' | 'advertiser') {
    return this.request('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ targetRole }),
    })
  }

  // Website management endpoints
  async getWebsites(publisherId: string, page = 1, limit = 10, status = '', category = '', search = '') {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
      ...(category && { category }),
      ...(search && { search })
    })
    return this.request(`/websites/publisher/${publisherId}?${params}`)
  }

  async getWebsite(websiteId: string) {
    return this.request(`/websites/${websiteId}`)
  }

  async createWebsite(websiteData: {
    url: string
    categories: string[]
    pricing: {
      guestPost?: number
      linkInsertion?: number
      writingGuestPost?: number
      extraLinks?: number
    }
    turnaroundTimeDays: number
    country: string
    language: string
    requirements?: {
      minWordCount?: number
      maxLinks?: number
    }
    ownershipVerification?: {
      method?: string
      verified?: boolean
      role?: string
      metaTagContent?: string
      fileName?: string
      dnsRecord?: string
    }
  }) {
    return this.request('/websites', {
      method: 'POST',
      body: JSON.stringify(websiteData),
    })
  }

  async updateWebsite(websiteId: string, websiteData: any) {
    return this.request(`/websites/${websiteId}`, {
      method: 'PUT',
      body: JSON.stringify(websiteData),
    })
  }

  async deleteWebsite(websiteId: string) {
    return this.request(`/websites/${websiteId}`, {
      method: 'DELETE',
    })
  }

  async updateWebsiteStatus(websiteId: string, status: string) {
    return this.request(`/websites/${websiteId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  async getWebsiteStats(publisherId: string) {
    return this.request(`/websites/stats/${publisherId}`)
  }

  // Advertiser endpoints
  async getAdvertiserWebsites(filters: {
    page?: number
    limit?: number
    category?: string
    country?: string
    language?: string
    minDomainAuthority?: number
    maxDomainAuthority?: number
    minGuestPostPrice?: number
    maxGuestPostPrice?: number
    minLinkInsertionPrice?: number
    maxLinkInsertionPrice?: number
    search?: string
    sortBy?: string
    sortOrder?: string
  } = {}) {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString())
      }
    })
    
    const url = `/websites/advertiser/websites?${params}`
    console.log('🚀 Making API request to:', url)
    return this.request(url)
  }

  async checkWebsiteUrl(url: string) {
    return this.request('/websites/check-url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
  }

  async verifyWebsiteOwnership(verificationData: {
    method: 'meta' | 'file' | 'dns' | 'skip'
    url: string
    metaTag?: string
    file?: File
    dnsRecord?: string
  }) {
    const formData = new FormData()
    formData.append('method', verificationData.method)
    formData.append('url', verificationData.url)
    
    if (verificationData.metaTag) {
      formData.append('metaTag', verificationData.metaTag)
    }
    if (verificationData.file) {
      formData.append('file', verificationData.file)
    }
    if (verificationData.dnsRecord) {
      formData.append('dnsRecord', verificationData.dnsRecord)
    }

    return this.request('/websites/verify-ownership', {
      method: 'POST',
      body: formData,
    })
  }

  // Admin website management endpoints
  async getAllWebsites(page = 1, limit = 10, status = '', category = '', search = '', publisherId = '') {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
      ...(category && { category }),
      ...(search && { search }),
      ...(publisherId && { publisherId })
    })
    return this.request(`/websites/admin/all?${params}`)
  }

  async getAllWebsiteStats() {
    return this.request('/websites/admin/stats')
  }

  async getPendingWebsitesCount() {
    return this.request('/websites/admin/pending-count')
  }

  // Bulk operations
  async bulkDeleteWebsites(websiteIds: string[]) {
    return this.request('/websites/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ websiteIds }),
    })
  }

  async bulkUpdateWebsiteStatus(websiteIds: string[], status: string) {
    return this.request('/websites/bulk/status', {
      method: 'PATCH',
      body: JSON.stringify({ websiteIds, status }),
    })
  }

  // Bulk user operations
  async bulkDeleteUsers(userIds: string[]) {
    return this.request('/users/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ userIds }),
    })
  }

  async bulkUpdateUserStatus(userIds: string[], status: string) {
    return this.request('/users/bulk/status', {
      method: 'PUT',
      body: JSON.stringify({ userIds, status }),
    })
  }

  async getUserStats() {
    return this.request('/users/stats')
  }

  async getUserActivities(userId: string) {
    return this.request(`/users/${userId}/activities`)
  }

  async getUserLoginTrends(period: string = '30d') {
    return this.request(`/users/login-trends?period=${period}`)
  }

  async getUserLoginTrendsWithDates(startDate: string, endDate: string) {
    return this.request(`/users/login-trends?startDate=${startDate}&endDate=${endDate}`)
  }

  async getOnlineUserStats() {
    return this.request('/users/online-stats')
  }

  async getOnlineUserTrends(period: string = '30d') {
    return this.request(`/users/online-trends?period=${period}`)
  }

  // Posts endpoints
  async savePostDraft(postData: {
    title: string
    completeUrl: string
    description?: string
    metaTitle?: string
    metaDescription?: string
    keywords?: string
    content: string
    anchorPairs?: { text: string; link: string }[]
    postType?: string
  }) {
    return this.request('/posts/draft', {
      method: 'POST',
      body: JSON.stringify(postData),
    })
  }

  async submitPost(postData: {
    title: string
    completeUrl: string
    description?: string
    metaTitle?: string
    metaDescription?: string
    keywords?: string
    content: string
    anchorPairs?: { text: string; link: string }[]
    postType?: string
  }) {
    return this.request('/posts/submit', {
      method: 'POST',
      body: JSON.stringify(postData),
    })
  }

  async getPosts() {
    return this.request<{ posts: any[] }>('/posts')
  }

  async getPost(postId: string) {
    return this.request<{ post: any }>(`/posts/${postId}`)
  }

  async updatePost(postId: string, postData: {
    title: string
    completeUrl: string
    description?: string
    metaTitle?: string
    metaDescription?: string
    keywords?: string
    content: string
    anchorPairs?: { text: string; link: string }[]
    postType?: string
    status?: string
  }) {
    return this.request(`/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(postData),
    })
  }

  async deletePost(postId: string) {
    return this.request(`/posts/${postId}`, {
      method: 'DELETE',
    })
  }

  async getPostsByUserId(userId: string) {
    return this.request(`/posts/admin/by-user/${userId}`)
  }

  async getOrdersByUserId(userId: string) {
    return this.request(`/orders/admin/by-user/${userId}`)
  }

  // Role management endpoints
  async getAllRoles() {
    return this.request('/roles')
  }

  async getRole(roleId: string) {
    return this.request(`/roles/${roleId}`)
  }

  async createRole(roleData: {
    name: string
    description: string
    permissions: string[]
    color?: string
  }) {
    return this.request('/roles', {
      method: 'POST',
      body: JSON.stringify(roleData),
    })
  }

  async updateRole(roleId: string, roleData: any) {
    return this.request(`/roles/${roleId}`, {
      method: 'PUT',
      body: JSON.stringify(roleData),
    })
  }

  async deleteRole(roleId: string) {
    return this.request(`/roles/${roleId}`, {
      method: 'DELETE',
    })
  }

  // System Configuration methods
  async getSystemConfig() {
    return this.request('/auth/system-config')
  }

  async updateSystemConfig(configData: {
    key: string
    value: any
    description?: string
    category?: string
  }) {
    return this.request('/auth/system-config', {
      method: 'PUT',
      body: JSON.stringify(configData),
    })
  }

  // Domain verification methods
  async verifyDomain(domain: string) {
    return this.request('/domain-verification/verify', {
      method: 'POST',
      body: JSON.stringify({ domain }),
    })
  }

  async getDomainVerificationCacheStats() {
    return this.request('/domain-verification/cache-stats')
  }

  async clearDomainVerificationCache(domain?: string) {
    return this.request('/domain-verification/cache', {
      method: 'DELETE',
      body: JSON.stringify({ domain }),
    })
  }

  // Link Insertion methods
  async createLinkInsertion(linkInsertionData: {
    postUrl: string
    anchorText: string
    anchorUrl: string
    currentText: string
    fixedText: string
    addingText: string
    status?: 'draft' | 'pending' | 'approved' | 'rejected'
  }) {
    return this.request('/link-insertions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(linkInsertionData),
    })
  }

  async getLinkInsertions(filters: {
    search?: string
    status?: string
    sortBy?: string
    sortOrder?: string
    page?: number
    limit?: number
  } = {}) {
    const params = new URLSearchParams()
    if (filters.search) params.append('search', filters.search)
    if (filters.status) params.append('status', filters.status)
    if (filters.sortBy) params.append('sortBy', filters.sortBy)
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)
    if (filters.page) params.append('page', filters.page.toString())
    if (filters.limit) params.append('limit', filters.limit.toString())
    
    return this.request(`/link-insertions?${params.toString()}`)
  }

  async getLinkInsertion(linkInsertionId: string) {
    return this.request(`/link-insertions/${linkInsertionId}`)
  }

  async updateLinkInsertion(linkInsertionId: string, linkInsertionData: {
    postUrl: string
    anchorText: string
    anchorUrl: string
    currentText: string
    fixedText: string
    addingText: string
    status?: 'draft' | 'pending' | 'approved' | 'rejected'
  }) {
    return this.request(`/link-insertions/${linkInsertionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(linkInsertionData),
    })
  }

  async deleteLinkInsertion(linkInsertionId: string) {
    return this.request(`/link-insertions/${linkInsertionId}`, {
      method: 'DELETE',
    })
  }

  // Generic HTTP methods for categories and other endpoints
  async get(endpoint: string) {
    return this.request(endpoint)
  }

  async post(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete(endpoint: string) {
    return this.request(endpoint, {
      method: 'DELETE',
    })
  }

  // Categories methods
  async getCategories() {
    return this.get('/categories/all?isActive=true')
  }

  // Order methods
  async placeOrder(items: Array<{
    websiteId: string
    type: 'guestPost' | 'linkInsertion' | 'writingGuestPost'
    price: number
    selectedPostId?: string
  }>) {
    return this.post('/orders', { items })
  }

  async getPublisherOrders(filters: {
    status?: string
    page?: number
    limit?: number
    search?: string
  } = {}) {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.page) params.append('page', filters.page.toString())
    if (filters.limit) params.append('limit', filters.limit.toString())
    if (filters.search) params.append('search', filters.search)
    
    return this.request(`/orders/publisher?${params.toString()}`)
  }

  async getAdvertiserOrders(filters: {
    status?: string
    page?: number
    limit?: number
  } = {}) {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.page) params.append('page', filters.page.toString())
    if (filters.limit) params.append('limit', filters.limit.toString())
    
    return this.request(`/orders/advertiser?${params.toString()}`)
  }

  async updateOrderStatus(orderId: string, status: string, note?: string, rejectionReason?: string, publishedUrl?: string) {
    return this.request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note, rejectionReason, publishedUrl })
    })
  }

  async getOrder(orderId: string) {
    return this.request(`/orders/${orderId}`)
  }

  async getOrderStats(userId: string) {
    return this.request(`/orders/stats/${userId}`)
  }

  // Admin order management methods
  async getAdminOrders(filters: {
    status?: string
    page?: number
    limit?: number
    search?: string
    advertiserId?: string
    publisherId?: string
    type?: string
    sortBy?: string
    sortOrder?: string
  } = {}) {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.page) params.append('page', filters.page.toString())
    if (filters.limit) params.append('limit', filters.limit.toString())
    if (filters.search) params.append('search', filters.search)
    if (filters.advertiserId) params.append('advertiserId', filters.advertiserId)
    if (filters.publisherId) params.append('publisherId', filters.publisherId)
    if (filters.type) params.append('type', filters.type)
    if (filters.sortBy) params.append('sortBy', filters.sortBy)
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)
    
    return this.request(`/orders/admin?${params.toString()}`)
  }

  async updateOrderStatusByAdmin(orderId: string, status: string, note?: string, rejectionReason?: string) {
    return this.request(`/orders/admin/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note, rejectionReason })
    })
  }

  async deleteOrderByAdmin(orderId: string) {
    return this.request(`/orders/admin/${orderId}`, {
      method: 'DELETE'
    })
  }

  // Calendar Event methods
  async getCalendarEvents(start?: string, end?: string) {
    const params = new URLSearchParams()
    if (start) params.append('start', start)
    if (end) params.append('end', end)
    
    return this.request(`/calendar${params.toString() ? `?${params.toString()}` : ''}`)
  }

  async getCalendarEvent(eventId: string) {
    return this.request(`/calendar/${eventId}`)
  }

  async createCalendarEvent(eventData: {
    title: string
    description?: string
    location?: string
    start: string | Date
    end?: string | Date
    allDay?: boolean
    backgroundColor?: string
    borderColor?: string
    textColor?: string
  }) {
    return this.request('/calendar', {
      method: 'POST',
      body: JSON.stringify(eventData)
    })
  }

  async updateCalendarEvent(eventId: string, eventData: {
    title?: string
    description?: string
    location?: string
    start?: string | Date
    end?: string | Date
    allDay?: boolean
    backgroundColor?: string
    borderColor?: string
    textColor?: string
  }) {
    return this.request(`/calendar/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(eventData)
    })
  }

  async deleteCalendarEvent(eventId: string) {
    return this.request(`/calendar/${eventId}`, {
      method: 'DELETE'
    })
  }

  // Order statistics methods
  async getOrderStatsTrends(period: '7d' | '30d' | '90d' = '30d') {
    return this.request(`/orders/admin/stats/trends?period=${period}`)
  }

  async getOrderStatsTrendsWithDates(startDate: string, endDate: string) {
    return this.request(`/orders/admin/stats/trends?startDate=${startDate}&endDate=${endDate}`)
  }

  async getPublisherOrderStatsTrends(period: '7d' | '30d' | '90d' = '30d') {
    return this.request(`/orders/publisher/stats/trends?period=${period}`)
  }

  async getPublisherOrderStatsTrendsWithDates(startDate: string, endDate: string) {
    return this.request(`/orders/publisher/stats/trends?startDate=${startDate}&endDate=${endDate}`)
  }

  async getPublisherEarningsTrends(period: '7d' | '30d' | '90d' = '30d') {
    return this.request(`/orders/publisher/earnings/trends?period=${period}`)
  }

  async getPublisherEarningsTrendsWithDates(startDate: string, endDate: string) {
    return this.request(`/orders/publisher/earnings/trends?startDate=${startDate}&endDate=${endDate}`)
  }

  async getAdvertiserOrderStatsTrends(period: '7d' | '30d' | '90d' = '30d') {
    return this.request(`/orders/advertiser/stats/trends?period=${period}`)
  }

  async getAdvertiserOrderStatsTrendsWithDates(startDate: string, endDate: string) {
    return this.request(`/orders/advertiser/stats/trends?startDate=${startDate}&endDate=${endDate}`)
  }

  // Balance methods
  async getBalance() {
    return this.request('/users/balance')
  }

  async addBalance(userId: string, amount: number) {
    return this.request('/users/balance/add', {
      method: 'POST',
      body: JSON.stringify({ userId, amount })
    })
  }
}

export const apiService = new ApiService(API_BASE_URL)
