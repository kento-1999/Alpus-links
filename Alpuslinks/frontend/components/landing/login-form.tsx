"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton'
import { TwoFactorAuthModal } from '@/components/auth/TwoFactorAuthModal'
import toast from 'react-hot-toast'

interface LoginFormProps {
  onSwitchToRegister: () => void
}

interface LoginFormData {
  email: string
  password: string
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const { login, sendTwoFactorCode, verifyTwoFactorCode, error, clearAuthError } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const [show2FA, setShow2FA] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  // Clear any existing auth errors on mount/refresh
  useEffect(() => {
    clearAuthError()
    setLocalError('')
  }, [clearAuthError])

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>()

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setLocalError('')
    clearAuthError()
    
    try {
      // Try to login first
      const success = await login(data.email, data.password)
      if (success) {
        // Login successful, no 2FA required (this includes super admin bypass)
        toast.success('Signed in successfully')
        return
      }
      
      // Wait a bit for Redux state to update with error
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // If login failed, check for specific error messages
      if (error) {
        const message = error
        console.log('Login error message:', message) // Debug log
        
        if (message === '2FA_REQUIRED') {
          console.log('2FA required, sending code...') // Debug log
          try {
            const codeSent = await sendTwoFactorCode(data.email, 'login')
            if (codeSent) {
              setUserEmail(data.email)
              setShow2FA(true)
              toast.success('Verification code sent to your email')
              return
            } else {
              toast.error('Failed to send verification code')
            }
          } catch (codeError: any) {
            console.error('Send 2FA code error:', codeError)
            toast.error('Failed to send verification code')
          }
        } else {
          // For all other errors (including invalid credentials), show error message
          toast.error('⚠️ Invalid email or password. Please check your credentials and try again.', {
            duration: 4000,
            style: {
              background: '#fef3c7',
              color: '#92400e',
              border: '1px solid #f59e0b'
            }
          })
        }
      } else {
        // If no error message but login failed, show generic error
        // Don't try to send 2FA code as fallback - only send when explicitly required
        toast.error('⚠️ Invalid email or password. Please check your credentials and try again.', {
          duration: 4000,
          style: {
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #f59e0b'
          }
        })
      }
    } catch (error: any) {
      console.error('Login error:', error)
      toast.error('⚠️ Invalid email or password. Please check your credentials and try again.', {
        duration: 4000,
        style: {
          background: '#fef3c7',
          color: '#92400e',
          border: '1px solid #f59e0b'
        }
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handle2FAVerify = async (code: string) => {
    try {
      const success = await verifyTwoFactorCode(userEmail, code, 'login')
      if (success) {
        setShow2FA(false)
        toast.success('Signed in successfully')
      }
      return success
    } catch (error: any) {
      console.error('2FA verification error:', error)
      return false
    }
  }

  const handle2FAResend = async () => {
    try {
      const success = await sendTwoFactorCode(userEmail, 'login')
      if (success) {
        toast.success('Verification code resent')
      } else {
        toast.error('Failed to resend code')
      }
    } catch (error: any) {
      console.error('Resend code error:', error)
      toast.error('Failed to resend code')
    }
  }

  const handle2FAClose = () => {
    setShow2FA(false)
    setUserEmail('')
  }

  const handleGoogleSuccess = () => {
    toast.success('Signed in with Google successfully')
  }

  const handleGoogleError = (error: string) => {
    toast.error(error)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome Back
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Sign in to your account to continue
        </p>
      </div>


      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Enter your email"
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters'
                }
              })}
              className={`w-full pl-10 pr-12 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
          )}
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              Remember me
            </span>
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google Login Button */}
        <GoogleLoginButton
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
        />

        {/* Switch to Register */}
        <div className="text-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
          </span>
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
          >
            Create Account
          </button>
        </div>
      </form>

      {/* 2FA Modal */}
      <TwoFactorAuthModal
        isOpen={show2FA}
        onClose={handle2FAClose}
        onVerify={handle2FAVerify}
        email={userEmail}
        onResendCode={handle2FAResend}
        isLoading={isLoading}
      />
    </div>
  )
}
