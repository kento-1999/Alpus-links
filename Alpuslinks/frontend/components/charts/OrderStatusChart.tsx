"use client"

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { Calendar, X } from 'lucide-react'

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface OrderStatusData {
  date: string
  requested: number
  inProgress: number
  advertiserApproval: number
  completed: number
  rejected: number
}

interface OrderStatusChartProps {
  data: OrderStatusData[]
  loading?: boolean
  onTimeRangeChange?: (timeRange: '7d' | '30d' | '90d' | 'custom') => void
  onCustomDateChange?: (startDate: string, endDate: string) => void
}

export function OrderStatusChart({ data, loading = false, onTimeRangeChange, onCustomDateChange }: OrderStatusChartProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d')
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const chartRef = useRef<any>(null)
  const { theme } = useTheme()

  // Initialize custom dates to last 30 days
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }, [])

  // Calculate totals for summary
  const totals = {
    requested: data.reduce((sum, item) => sum + item.requested, 0),
    inProgress: data.reduce((sum, item) => sum + item.inProgress, 0),
    advertiserApproval: data.reduce((sum, item) => sum + item.advertiserApproval, 0),
    completed: data.reduce((sum, item) => sum + item.completed, 0),
    rejected: data.reduce((sum, item) => sum + item.rejected, 0)
  }

  // Format date for display (short month and day)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Prepare chart data
  const categories = data.map(item => formatDate(item.date))
  const series = [
    {
      name: 'Requested',
      data: data.map(item => item.requested)
    },
    {
      name: 'In Progress',
      data: data.map(item => item.inProgress)
    },
    {
      name: 'Pending Approval',
      data: data.map(item => item.advertiserApproval)
    },
    {
      name: 'Completed',
      data: data.map(item => item.completed)
    },
    {
      name: 'Rejected',
      data: data.map(item => item.rejected)
    }
  ]

  // Chart options matching Metronic Earnings style - Beautiful layout
  const chartOptions: any = {
    series: series,
    chart: {
      type: 'area',
      height: 320,
      stacked: true,
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
      },
      sparkline: {
        enabled: false
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 3,
      lineCap: 'round',
      colors: ['#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EF4444']
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
        
        const seriesNames = ['Requested', 'In Progress', 'Pending Approval', 'Completed', 'Rejected']
        const colors = ['#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EF4444']
        
        series.forEach((s: any, idx: number) => {
          const value = s[dataPointIndex]
          if (value > 0) {
            const secondaryTextColor = theme === 'dark' ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)'
            tooltipContent += `
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 0.75rem; height: 0.75rem; border-radius: 50%; background-color: ${colors[idx]};"></div>
                <span style="font-size: 0.75rem; color: ${secondaryTextColor};">${seriesNames[idx]}:</span>
                <span style="font-weight: 600; font-size: 0.875rem; color: ${textColor};">${value}</span>
              </div>
            `
          }
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
        fillColors: ['#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EF4444'],
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
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 50, 100]
      }
    },
    markers: {
      size: 0,
      strokeColors: '#fff',
      strokeWidth: 2,
      hover: {
        size: 8,
        sizeOffset: 2
      }
    },
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
    colors: ['#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EF4444'],
    plotOptions: {
      area: {
        fillTo: 'end'
      }
    }
  }

  if (loading) {
    return (
      <div className="kt-card h-full">
        <div className="kt-card-header">
          <h3 className="kt-card-title">Order Status</h3>
        </div>
        <div className="kt-card-content flex flex-col justify-end items-stretch grow px-3 py-1">
          <div className="animate-pulse h-[300px] bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="kt-card h-full shadow-sm">
      <div className="kt-card-header px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="kt-card-title text-xl font-semibold text-foreground">Order Status</h3>
          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </div>
      <div className="kt-card-content flex flex-col justify-end items-stretch grow px-3 py-1">
        <div id="order_status_chart" className="w-full">
          {typeof window !== 'undefined' && (
            <Chart
              options={chartOptions}
              series={chartOptions.series}
              type="area"
              height={320}
            />
          )}
        </div>
      </div>
      
      {/* Summary Stats - Beautiful Footer */}
      <div className="kt-card-footer border-t border-border px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6 w-full">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F59E0B] shadow-sm"></div>
              <span className="text-sm font-medium text-muted-foreground">Requested</span>
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {totals.requested}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#3B82F6] shadow-sm"></div>
              <span className="text-sm font-medium text-muted-foreground">In Progress</span>
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {totals.inProgress}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#8B5CF6] shadow-sm"></div>
              <span className="text-sm font-medium text-muted-foreground">Pending Approval</span>
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {totals.advertiserApproval}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#10B981] shadow-sm"></div>
              <span className="text-sm font-medium text-muted-foreground">Completed</span>
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {totals.completed}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#EF4444] shadow-sm"></div>
              <span className="text-sm font-medium text-muted-foreground">Rejected</span>
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {totals.rejected}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
