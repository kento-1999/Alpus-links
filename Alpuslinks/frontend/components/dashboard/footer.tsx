"use client"

import { useState, useEffect } from 'react'

export function Footer() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  useEffect(() => {
    setCurrentYear(new Date().getFullYear())
  }, [])

  return (
    <footer className="kt-footer bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="kt-footer__container px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-2 md:space-y-0">
          {/* Left side - Copyright */}
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © {currentYear} AlpusLinks. All rights reserved.
            </p>
          </div>

          {/* Right side - Links and Version */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4">
              <a 
                href="#" 
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Privacy Policy
              </a>
              <a 
                href="#" 
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Terms of Service
              </a>
              <a 
                href="#" 
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Support
              </a>
            </div>
            
            <div className="hidden md:block w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
            
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 dark:text-gray-500">
                Version
              </span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                v1.0.0
              </span>
            </div>
          </div>
        </div>


      </div>
    </footer>
  )
}
