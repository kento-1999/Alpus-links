"use client"

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { 
  Search, 
  Bell, 
  Settings, 
  User, 
  LogOut,
  Menu,
  Sun,
  Moon
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { getRoleName, getRoleNameLowercase } from '@/lib/roleUtils'
import { DefaultAvatar } from '@/components/ui/DefaultAvatar'
import { ShoppingCart } from 'lucide-react'
import { useAppSelector } from '@/hooks/redux'
import { selectCartSummary } from '@/store/slices/cartSlice'

export function Header() {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { user, logout, switchRole } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const cartSummary = useAppSelector(selectCartSummary)
  const currentRole = getRoleName(user?.role).toLowerCase()
  const profileRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close profile dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isProfileOpen])

  // Generate breadcrumb from pathname
  const generateBreadcrumb = () => {
    const segments = pathname.split('/').filter(Boolean)
    const breadcrumbs: Array<{ label: string; href: string; isLast: boolean }> = []
    
    // Helper function to check if a segment looks like an ID (MongoDB ObjectId or UUID)
    const isIdSegment = (segment: string): boolean => {
      // MongoDB ObjectId: 24 hex characters
      if (/^[0-9a-fA-F]{24}$/.test(segment)) return true
      // UUID format: 8-4-4-4-12 hex characters
      if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(segment)) return true
      return false
    }
    
    // Helper function to get dashboard path based on user role
    const getDashboardPath = (): string => {
      const roleName = getRoleNameLowercase(user?.role)
      switch (roleName) {
        case 'super admin':
        case 'admin':
          return '/alpus-admin/dashboard'
        case 'publisher':
          return '/publisher/dashboard'
        case 'advertiser':
          return '/advertiser/dashboard'
        case 'supportor':
          return '/supportor/account'
        default:
          return '/'
      }
    }
    
    // Add home - redirect to dashboard based on role
    breadcrumbs.push({ label: 'Home', href: getDashboardPath(), isLast: segments.length === 0 })
    
    // Add path segments (skip ID segments)
    let currentPath = ''
    segments.forEach((segment, index) => {
      // Skip displaying ID segments in breadcrumb
      if (isIdSegment(segment)) {
        currentPath += `/${segment}`
        return
      }
      
      currentPath += `/${segment}`
      const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
      
      // Check if this is the last non-ID segment
      const remainingSegments = segments.slice(index + 1)
      const hasNonIdSegmentsAfter = remainingSegments.some(s => !isIdSegment(s))
      const isLast = !hasNonIdSegmentsAfter
      
      // Determine href - redirect post, link insertion, and writing gp to project management
      // and redirect advertiser to dashboard
      let href = currentPath
      if (segment === 'advertiser') {
        href = '/advertiser/dashboard'
      } else if (segment === 'post' || segment === 'link-insertion' || segment === 'writing-gp') {
        // Check if we're in the advertiser section
        const advertiserIndex = segments.findIndex(s => s === 'advertiser')
        if (advertiserIndex !== -1) {
          href = '/advertiser/project'
        }
      }
      
      breadcrumbs.push({ 
        label, 
        href,
        isLast
      })
    })
    
    return breadcrumbs
  }

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const handleLogout = () => {
    logout()
  }

  const handleSwitchRole = async () => {
    if (!user) return
    
    const currentRole = getRoleName(user?.role).toLowerCase()
    const targetRole = currentRole === 'publisher' ? 'advertiser' : 'publisher'
    
    try {
      await switchRole(targetRole as 'publisher' | 'advertiser')
      setIsProfileOpen(false)
    } catch (error) {
      console.error('Role switch failed:', error)
    }
  }

  // Check if user is admin (admin or super admin)
  const isAdmin = () => {
    if (!user?.role) return false
    const roleName = getRoleName(user.role).toLowerCase()
    return roleName === 'admin' || roleName === 'super admin'
  }

  const handleAccountClick = () => {
    const userRole = getRoleName(user?.role)
    const roleName = userRole.toLowerCase()
    
    if (roleName === 'super admin' || roleName === 'admin') {
      router.push('/alpus-admin/account')
    } else if (roleName === 'publisher') {
      router.push('/publisher/account')
    } else if (roleName === 'advertiser') {
      router.push('/advertiser/account')
    } else if (roleName === 'supportor') {
      router.push('/supportor/account')
    } else {
      router.push('/')
    }
    
    setIsProfileOpen(false)
  }

  return (
    <header className="kt-header bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="kt-header__container">
        <div className="flex items-center justify-between w-full">
          {/* Left side - Breadcrumb and Menu */}
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors lg:hidden">
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            
            {/* Breadcrumb */}
            <nav className="kt-header__breadcrumb">
              {generateBreadcrumb().map((crumb, index) => (
                <div key={index} className="flex items-center">
                  {index > 0 && (
                    <span className="kt-header__breadcrumb-separator mx-2">/</span>
                  )}
                  {crumb.isLast ? (
                    <span className="kt-header__breadcrumb-item--active">{crumb.label}</span>
                  ) : (
                    <Link 
                      href={crumb.href}
                      className="kt-header__breadcrumb-item hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </div>
              ))}
            </nav>
          </div>

          {/* Right side - Cart, Notifications, Theme, Profile */}
          <div className="flex items-center space-x-3 ml-auto">

            {/* Cart (only for Advertiser) */}
            {currentRole === 'advertiser' && (
              <Link
                href="/advertiser/cart"
                className="group relative p-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all duration-200"
                aria-label="Cart"
                title="Cart"
              >
                <ShoppingCart className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200" />
                {cartSummary.quantity > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] leading-none bg-blue-600 text-white rounded-full">
                    {cartSummary.quantity}
                  </span>
                )}
              </Link>
            )}

            {/* Notifications */}
            <button 
              className="group relative p-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all duration-200"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-sm">
                <span className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></span>
              </span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="group relative p-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all duration-200"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-all duration-300 group-hover:rotate-12" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-all duration-300 group-hover:-rotate-12" />
              )}
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center">
                  {user?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={user.avatar} 
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <DefaultAvatar className="w-full h-full" alt={`${user?.firstName} ${user?.lastName}`} />
                  )}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getRoleName(user?.role)}
                  </p>
                </div>
              </button>

              {/* Overlay */}
              {isProfileOpen && (
                <div 
                  className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                  onClick={() => setIsProfileOpen(false)}
                />
              )}

              {/* Dropdown Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.email}
                    </p>
                  </div>
                  
                  <button 
                    onClick={handleAccountClick}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  
                  {/* Only show switch role button for non-admin users */}
                  {!isAdmin() && (
                    <button 
                      onClick={handleSwitchRole}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Switch Role</span>
                    </button>
                  )}
                  
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
