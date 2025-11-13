'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface GoogleLoginButtonProps {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function GoogleLoginButton({ onSuccess, onError }: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const { googleSignIn } = useAuth()

  // Detect dark mode
  useEffect(() => {
    const detectDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark') || 
                    window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDarkMode(isDark)
    }
    
    detectDarkMode()
    
    // Listen for theme changes
    const observer = new MutationObserver(detectDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', detectDarkMode)
    
    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', detectDarkMode)
    }
  }, [])

  // Initialize Google Sign-In when component mounts
  useEffect(() => {
    if (!isInitialized) {
      initializeGoogleSignIn()
    }
  }, [isInitialized])

  // Re-render button when theme changes
  useEffect(() => {
    if (isInitialized && window.google) {
      const buttonElement = document.getElementById('google-signin-button')
      if (buttonElement) {
        // Clear and re-render with new theme
        buttonElement.innerHTML = ''
        window.google.accounts.id.renderButton(buttonElement, {
          theme: isDarkMode ? 'filled_black' : 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'signin_with',
          logo_alignment: 'left'
        })
        console.log('🔄 Google button re-rendered with theme:', isDarkMode ? 'dark' : 'light');
      }
    }
  }, [isDarkMode, isInitialized])

  const initializeGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      
      // Check if Google Client ID is configured
      if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
        console.error('❌ Google Client ID is not configured');
        onError?.('Google login is not configured. Please contact the administrator.')
        setIsLoading(false)
        return
      }
      
      console.log('🔍 Google Login Debug Info:');
      console.log('   Client ID:', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
      console.log('   Current URL:', window.location.href);
      console.log('   User Agent:', navigator.userAgent);
      
      // Load Google Identity Services
      if (!window.google) {
        console.log('📦 Loading Google Identity Services script...');
        // Load the Google Identity Services script
        const script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        document.head.appendChild(script)
        
        await new Promise((resolve) => {
          script.onload = resolve
        })
        console.log('✅ Google Identity Services script loaded');
      }

      // Initialize Google Identity Services
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      console.log('🔧 Initializing Google Identity Services...');
      console.log('🔑 Using Client ID:', clientId ? `${clientId.substring(0, 20)}...` : 'NOT SET');
      
      if (!clientId) {
        throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured');
      }
      
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: false, // Disable FedCM to avoid conflicts
        itp_support: true, // Support Intelligent Tracking Prevention
        context: 'signin', // Explicitly set context for better COOP compatibility
        ux_mode: 'popup', // Use popup mode for better COOP compatibility
      })
      console.log('✅ Google Identity Services initialized');

      // Use renderButton instead of prompt for better control
      console.log('🚀 Rendering Google sign-in button...');
      const buttonElement = document.getElementById('google-signin-button')
      if (buttonElement) {
        // Clear any existing button
        buttonElement.innerHTML = ''
        
        window.google.accounts.id.renderButton(buttonElement, {
          theme: isDarkMode ? 'filled_black' : 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'signin_with',
          logo_alignment: 'left'
        })
        setIsInitialized(true)
        console.log('✅ Google sign-in button rendered with theme:', isDarkMode ? 'dark' : 'light');
      }

    } catch (error) {
      console.error('❌ Google login error:', error)
      onError?.('Failed to initialize Google login')
      setIsLoading(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCredentialResponse = async (response: any) => {
    try {
      setIsLoading(true)
      
      if (!response || !response.credential) {
        console.error('❌ Invalid Google credential response');
        onError?.('Invalid response from Google. Please try again.')
        setIsLoading(false)
        return
      }
      
      console.log('🎫 Google credential received:', {
        hasCredential: !!response.credential,
        credentialLength: response.credential?.length,
        responseKeys: Object.keys(response)
      });
      
      // Send the credential to your backend
      console.log('📤 Sending credential to backend...');
      const result = await googleSignIn(response.credential)
      
      if (result) {
        console.log('✅ Google login successful');
        onSuccess?.()
      } else {
        console.log('❌ Google login failed - no result');
        onError?.('Google login failed. Please try again.')
      }
    } catch (error: any) {
      console.error('❌ Google credential handling error:', error)
      
      // Provide more specific error messages
      let errorMessage = 'Google login failed. Please try again.'
      
      if (error?.message) {
        if (error.message.includes('not configured') || error.message.includes('GOOGLE_NOT_CONFIGURED')) {
          errorMessage = 'Google login is not configured. Please contact support.'
        } else if (error.message.includes('expired') || error.message.includes('TOKEN_EXPIRED')) {
          errorMessage = 'Your session has expired. Please try logging in again.'
        } else if (error.message.includes('invalid') || error.message.includes('INVALID_TOKEN')) {
          errorMessage = 'Invalid authentication token. Please try again.'
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.'
        } else {
          errorMessage = error.message
        }
      }
      
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      {/* Google's native button will be rendered here */}
      <div 
        id="google-signin-button" 
        className={`w-full google-button-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
        style={{
          '--google-button-theme': isDarkMode ? 'dark' : 'light'
        } as React.CSSProperties}
      ></div>
      
      {/* Beautiful custom fallback button */}
      {!isInitialized && (
        <button
          type="button"
          onClick={initializeGoogleSignIn}
          disabled={isLoading}
          className={`
            w-full h-12 px-4 rounded-lg font-medium text-sm
            flex items-center justify-center gap-3
            transition-all duration-200 ease-in-out
            transform hover:scale-[1.02] active:scale-[0.98]
            shadow-sm hover:shadow-md
            border-2 border-transparent
            ${isDarkMode 
              ? 'bg-gray-800 hover:bg-gray-700 text-white border-gray-600 hover:border-gray-500' 
              : 'bg-white hover:bg-gray-50 text-gray-900 border-gray-200 hover:border-gray-300'
            }
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
          `}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {/* Beautiful Google Logo */}
              <div className="flex items-center justify-center w-5 h-5">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              <span className="font-medium">
                {isLoading ? 'Initializing...' : 'Continue with Google'}
              </span>
            </>
          )}
        </button>
      )}
      
      {/* Custom CSS for enhanced Google button styling */}
      <style jsx>{`
        .google-button-container {
          position: relative;
        }
        
        .google-button-container :global(div[role="button"]) {
          width: 100% !important;
          height: 48px !important;
          border-radius: 8px !important;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-weight: 500 !important;
          font-size: 14px !important;
          transition: all 0.2s ease-in-out !important;
          transform: translateZ(0) !important;
          backface-visibility: hidden !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
        }
        
        .google-button-container :global(div[role="button"]:hover) {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }
        
        .google-button-container :global(div[role="button"]:active) {
          transform: translateY(0) !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
        }
        
        /* Light mode styling */
        .light-mode :global(div[role="button"]) {
          background: #ffffff !important;
          border: 1px solid #dadce0 !important;
          color: #3c4043 !important;
          box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15) !important;
        }
        
        .light-mode :global(div[role="button"]:hover) {
          background: #f8f9fa !important;
          border-color: #dadce0 !important;
          box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15) !important;
        }
        
        /* Dark mode styling */
        .dark-mode :global(div[role="button"]) {
          background: #1f2937 !important;
          border: 1px solid #374151 !important;
          color: #ffffff !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15) !important;
        }
        
        .dark-mode :global(div[role="button"]:hover) {
          background: #374151 !important;
          border-color: #4b5563 !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15) !important;
        }
        
        /* Focus states */
        .google-button-container :global(div[role="button"]:focus) {
          outline: 2px solid #3b82f6 !important;
          outline-offset: 2px !important;
        }
        
        /* Disabled state */
        .google-button-container :global(div[role="button"]:disabled) {
          opacity: 0.6 !important;
          cursor: not-allowed !important;
          transform: none !important;
        }
      `}</style>
    </div>
  )
}

// Extend the Window interface to include Google Identity Services
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void
          prompt: (callback?: (notification: any) => void) => void
          renderButton: (element: HTMLElement, config: any) => void
        }
      }
    }
  }
}
