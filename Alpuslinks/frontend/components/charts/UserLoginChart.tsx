"use client"

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { Calendar, X } from 'lucide-react'

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface UserLoginData {
  date: string
  advertisers: number
  publishers: number
  total: number
}

interface UserLoginChartProps {
  data: UserLoginData[]
  loading?: boolean
  onTimeRangeChange?: (timeRange: '7d' | '30d' | '90d' | 'custom') => void
  onCustomDateChange?: (startDate: string, endDate: string) => void
}

export function UserLoginChart({ data, loading = false, onTimeRangeChange, onCustomDateChange }: UserLoginChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d')
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const { theme } = useTheme()

  // Initialize custom dates to last 30 days
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }, [])

  // Format date for display (short month and day)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Prepare chart data
  const categories = data.map(item => formatDate(item.date))
  const series = [
    {
      name: 'Advertisers',
      data: data.map(item => item.advertisers)
    },
    {
      name: 'Publishers',
      data: data.map(item => item.publishers)
    },
    {
      name: 'Total',
      data: data.map(item => item.total)
    }
  ]

  // Chart options for ApexCharts - Beautiful layout
  const chartOptions: any = {
    series: series,
    chart: {
      type: chartType === 'line' ? 'area' : 'bar',
      height: 320,
      stacked: chartType === 'line' ? false : false,
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: chartType === 'line' ? {
      curve: 'smooth',
      width: 3,
      lineCap: 'round'
    } : {
      width: 0
    },
    xaxis: {
      categories: categories,
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      labels: {
        style: {
          colors: theme === 'dark' ? '#9CA3AF' : '#6B7280',
          fontSize: '12px',
          fontFamily: 'inherit',
          fontWeight: 400
        },
        offsetY: 4
      },
      crosshairs: {
        show: true,
        position: 'front',
        stroke: {
          color: theme === 'dark' ? '#3B82F6' : '#3B82F6',
          width: 1,
          dashArray: 3,
          opacity: 0.7
        }
      },
      tooltip: {
        enabled: false
      }
    },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      axisTicks: {
        show: false
      },
      axisBorder: {
        show: false
      },
      labels: {
        style: {
          colors: theme === 'dark' ? '#9CA3AF' : '#6B7280',
          fontSize: '12px',
          fontFamily: 'inherit',
          fontWeight: 400
        },
        offsetX: -8
      }
    },
    tooltip: {
      enabled: true,
      shared: true,
      intersect: false,
      followCursor: true,
      theme: theme === 'dark' ? 'dark' : 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'inherit'
      },
      custom: function({ series, seriesIndex, dataPointIndex, w }: any) {
        const date = categories[dataPointIndex]
        const bgColor = theme === 'dark' ? 'rgb(31, 41, 55)' : 'rgb(255, 255, 255)'
        const textColor = theme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(17, 24, 39)'
        const borderColor = theme === 'dark' ? 'rgb(55, 65, 81)' : 'rgb(229, 231, 235)'
        
        let tooltipContent = `
          <div style="background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); padding: 0.875rem;">
            <div style="font-weight: 500; font-size: 0.875rem; color: ${textColor}; margin-bottom: 0.5rem;">${date}</div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        `
        
        const seriesNames = ['Advertisers', 'Publishers', 'Total']
        const colors = ['#3B82F6', '#10B981', '#F59E0B']
        
        series.forEach((s: any, idx: number) => {
          const value = s[dataPointIndex]
          const secondaryTextColor = theme === 'dark' ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)'
          tooltipContent += `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div style="width: 0.75rem; height: 0.75rem; border-radius: 50%; background-color: ${colors[idx]};"></div>
              <span style="font-size: 0.75rem; color: ${secondaryTextColor};">${seriesNames[idx]}:</span>
              <span style="font-weight: 600; font-size: 0.875rem; color: ${textColor};">${value}</span>
            </div>
          `
        })
        
        tooltipContent += `
            </div>
          </div>
        `
        
        return tooltipContent
      }
    },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'right',
      floating: false,
      fontSize: '12px',
      fontWeight: 500,
      fontFamily: 'inherit',
      offsetY: -8,
      offsetX: 0,
      labels: {
        colors: theme === 'dark' ? '#D1D5DB' : '#4B5563',
        useSeriesColors: false
      },
      markers: {
        width: 10,
        height: 10,
        radius: 5,
        strokeWidth: 0,
        strokeColor: '#fff',
        fillColors: ['#3B82F6', '#10B981', '#F59E0B'],
        offsetX: -2,
        offsetY: 0
      },
      itemMargin: {
        horizontal: 12,
        vertical: 6
      },
      onItemClick: {
        toggleDataSeries: true
      },
      onItemHover: {
        highlightDataSeries: true
      }
    },
    fill: chartType === 'line' ? {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 50, 100]
      }
    } : {
      type: 'solid',
      opacity: 0.85
    },
    markers: chartType === 'line' ? {
      size: 5,
      strokeColors: '#fff',
      strokeWidth: 2,
      hover: {
        size: 10,
        sizeOffset: 3
      },
      colors: ['#3B82F6', '#10B981', '#F59E0B']
    } : {
      size: 0
    },
    plotOptions: chartType === 'bar' ? {
      bar: {
        horizontal: false,
        borderRadius: 6,
        columnWidth: '60%',
        distributed: false,
        dataLabels: {
          position: 'top'
        },
        barHeight: '85%'
      }
    } : chartType === 'line' ? {
      area: {
        fillTo: 'end'
      }
    } : {},
    grid: {
      borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)',
      strokeDashArray: 5,
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: true,
          offsetX: 0
        }
      },
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    },
    colors: ['#3B82F6', '#10B981', '#F59E0B']
  }

  // Calculate totals for summary
  const totals = {
    advertisers: data.reduce((sum, item) => sum + item.advertisers, 0),
    publishers: data.reduce((sum, item) => sum + item.publishers, 0),
    total: data.reduce((sum, item) => sum + item.total, 0)
  }

  if (loading) {
    return (
      <div className="kt-card h-full shadow-sm">
        <div className="kt-card-header px-6 py-4 border-b border-border">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          </div>
        </div>
        <div className="kt-card-content flex flex-col justify-end items-stretch grow px-3 py-1">
          <div className="animate-pulse h-[320px] bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="kt-card h-full shadow-sm">
      <div className="kt-card-header px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="kt-card-title text-xl font-semibold text-foreground">User Logins</h3>
            <p className="text-sm text-muted-foreground mt-1">Login activity trends over time</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Time Range Selector */}
            <div className="relative">
              <select
                className="kt-select w-36 px-3 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer appearance-none pr-8"
                value={timeRange}
                onChange={(e) => {
                  const newRange = e.target.value as '7d' | '30d' | '90d' | 'custom'
                  setTimeRange(newRange)
                  if (newRange === 'custom') {
                    setShowCustomDatePicker(true)
                  } else {
                    setShowCustomDatePicker(false)
                    onTimeRangeChange?.(newRange)
                  }
                }}
              >
                <option value="7d" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">7 days</option>
                <option value="30d" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">1 month</option>
                <option value="90d" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">3 months</option>
                <option value="custom" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Custom</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg 
                  className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Custom Date Picker */}
            {showCustomDatePicker && (
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-2">
                <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 text-sm font-medium bg-transparent border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-500 dark:text-gray-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-2 py-1 text-sm font-medium bg-transparent border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    if (startDate && endDate && new Date(startDate) <= new Date(endDate)) {
                      onCustomDateChange?.(startDate, endDate)
                    }
                  }}
                  className="px-3 py-1 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setShowCustomDatePicker(false)
                    setTimeRange('30d')
                    onTimeRangeChange?.('30d')
                  }}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Chart Type Selector */}
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              {(['line', 'bar'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    chartType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {type === 'line' ? 'Line' : 'Bar'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="kt-card-content flex flex-col justify-end items-stretch grow px-3 py-1">
        <div id="user_login_chart" className="w-full">
          {typeof window !== 'undefined' && (
            <Chart
              options={chartOptions}
              series={chartOptions.series}
              type={chartType === 'line' ? 'area' : 'bar'}
              height={320}
            />
          )}
        </div>
      </div>

      {/* Summary Stats - Beautiful Footer */}
      <div className="kt-card-footer border-t border-border px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#3B82F6] shadow-sm"></div>
              <span className="text-sm font-medium text-muted-foreground">Advertisers</span>
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {totals.advertisers}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#10B981] shadow-sm"></div>
              <span className="text-sm font-medium text-muted-foreground">Publishers</span>
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {totals.publishers}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F59E0B] shadow-sm"></div>
              <span className="text-sm font-medium text-muted-foreground">Total</span>
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {totals.total}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
