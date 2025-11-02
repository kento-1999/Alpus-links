"use client"

import { ProtectedRoute } from '@/components/auth/protected-route'
import { useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Calendar, Plus, X, Edit2, Trash2, MapPin, Clock, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiService } from '@/lib/api'

// Types
interface CalendarEvent {
  id?: string
  _id?: string
  title: string
  description?: string
  location?: string
  start: Date | string
  end?: Date | string
  allDay: boolean
  backgroundColor?: string
  borderColor?: string
  textColor?: string
  createdBy?: any
  updatedBy?: any
}

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const calendarRef = useRef<FullCalendar>(null)

  // Form state for add/edit
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    allDay: false
  })

  // Load events from API
  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      setLoading(true)
      const response = await apiService.getCalendarEvents() as any
      
      if (response.data?.success) {
        const eventsData = response.data.data || []
        const eventsWithDates = eventsData.map((event: any) => ({
          id: event._id,
          _id: event._id,
          title: event.title,
          description: event.description,
          location: event.location,
          start: new Date(event.start),
          end: event.end ? new Date(event.end) : undefined,
          allDay: event.allDay || false,
          backgroundColor: event.backgroundColor || '#3b82f6',
          borderColor: event.borderColor || '#3b82f6',
          textColor: event.textColor || '#ffffff',
          createdBy: event.createdBy,
          updatedBy: event.updatedBy
        }))
        setEvents(eventsWithDates)
      } else {
        throw new Error(response.data?.message || 'Failed to load events')
      }
    } catch (error) {
      console.error('Error loading events:', error)
      toast.error('Failed to load calendar events')
    } finally {
      setLoading(false)
    }
  }

  const handleDateSelect = (selectInfo: any) => {
    setFormData({
      title: '',
      description: '',
      location: '',
      startDate: selectInfo.startStr.split('T')[0],
      startTime: selectInfo.allDay ? '' : selectInfo.startStr.split('T')[1]?.substring(0, 5) || '',
      endDate: selectInfo.endStr ? selectInfo.endStr.split('T')[0] : selectInfo.startStr.split('T')[0],
      endTime: selectInfo.allDay ? '' : selectInfo.endStr?.split('T')[1]?.substring(0, 5) || '',
      allDay: selectInfo.allDay
    })
    setShowAddModal(true)
    
    // Unselect the date selection
    const calendarApi = selectInfo.view.calendar
    calendarApi.unselect()
  }

  const handleEventClick = async (clickInfo: any) => {
    const event = clickInfo.event
    try {
      // Fetch full event details from API
      const response = await apiService.getCalendarEvent(event.id) as any
      
      if (response.data?.success) {
        const eventData = response.data.data
        setSelectedEvent({
          id: eventData._id,
          _id: eventData._id,
          title: eventData.title,
          description: eventData.description || '',
          location: eventData.location || '',
          start: new Date(eventData.start),
          end: eventData.end ? new Date(eventData.end) : undefined,
          allDay: eventData.allDay || false,
          backgroundColor: eventData.backgroundColor,
          borderColor: eventData.borderColor,
          textColor: eventData.textColor,
          createdBy: eventData.createdBy,
          updatedBy: eventData.updatedBy
        })
        setShowViewModal(true)
      } else {
        // Fallback to event data from calendar
        const eventData: CalendarEvent = {
          id: event.id,
          title: event.title,
          description: event.extendedProps.description || '',
          location: event.extendedProps.location || '',
          start: event.start!,
          end: event.end || undefined,
          allDay: event.allDay || false,
          backgroundColor: event.backgroundColor,
          borderColor: event.borderColor,
          textColor: event.textColor
        }
        setSelectedEvent(eventData)
        setShowViewModal(true)
      }
    } catch (error) {
      console.error('Error fetching event:', error)
      // Fallback to event data from calendar
      const eventData: CalendarEvent = {
        id: event.id,
        title: event.title,
        description: event.extendedProps.description || '',
        location: event.extendedProps.location || '',
        start: event.start!,
        end: event.end || undefined,
        allDay: event.allDay || false,
        backgroundColor: event.backgroundColor,
        borderColor: event.borderColor,
        textColor: event.textColor
      }
      setSelectedEvent(eventData)
      setShowViewModal(true)
    }
  }

  const handleAddEvent = async () => {
    if (!formData.title.trim()) {
      toast.error('Event title is required')
      return
    }

    try {
      const startDate = formData.allDay
        ? new Date(formData.startDate)
        : new Date(`${formData.startDate}T${formData.startTime}`)
      
      const endDate = formData.allDay
        ? (formData.endDate ? new Date(formData.endDate) : undefined)
        : (formData.endDate && formData.endTime
          ? new Date(`${formData.endDate}T${formData.endTime}`)
          : undefined)

      const eventData = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        start: startDate.toISOString(),
        end: endDate ? endDate.toISOString() : undefined,
        allDay: formData.allDay,
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
        textColor: '#ffffff'
      }

      const response = await apiService.createCalendarEvent(eventData) as any
      
      if (response.data?.success) {
        toast.success('Event added successfully')
        resetForm()
        setShowAddModal(false)
        loadEvents() // Reload events from API
      } else {
        throw new Error(response.data?.message || 'Failed to create event')
      }
    } catch (error) {
      console.error('Error adding event:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add event')
    }
  }

  const handleEditEvent = async () => {
    if (!selectedEvent || !formData.title.trim()) {
      toast.error('Event title is required')
      return
    }

    try {
      const eventId = selectedEvent._id || selectedEvent.id
      if (!eventId) {
        toast.error('Event ID is missing')
        return
      }

      const startDate = formData.allDay
        ? new Date(formData.startDate)
        : new Date(`${formData.startDate}T${formData.startTime}`)
      
      const endDate = formData.allDay
        ? (formData.endDate ? new Date(formData.endDate) : undefined)
        : (formData.endDate && formData.endTime
          ? new Date(`${formData.endDate}T${formData.endTime}`)
          : undefined)

      const eventData = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        start: startDate.toISOString(),
        end: endDate ? endDate.toISOString() : undefined,
        allDay: formData.allDay,
        backgroundColor: selectedEvent.backgroundColor,
        borderColor: selectedEvent.borderColor,
        textColor: selectedEvent.textColor
      }

      const response = await apiService.updateCalendarEvent(eventId.toString(), eventData) as any
      
      if (response.data?.success) {
        toast.success('Event updated successfully')
        resetForm()
        setShowEditModal(false)
        setSelectedEvent(null)
        loadEvents() // Reload events from API
      } else {
        throw new Error(response.data?.message || 'Failed to update event')
      }
    } catch (error) {
      console.error('Error updating event:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update event')
    }
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return

    try {
      const eventId = selectedEvent._id || selectedEvent.id
      if (!eventId) {
        toast.error('Event ID is missing')
        return
      }

      const response = await apiService.deleteCalendarEvent(eventId.toString()) as any
      
      if (response.data?.success) {
        toast.success('Event deleted successfully')
        setShowViewModal(false)
        setSelectedEvent(null)
        loadEvents() // Reload events from API
      } else {
        throw new Error(response.data?.message || 'Failed to delete event')
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete event')
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      location: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      allDay: false
    })
  }

  const openEditModal = () => {
    if (!selectedEvent) return
    
    setFormData({
      title: selectedEvent.title,
      description: selectedEvent.description || '',
      location: selectedEvent.location || '',
      startDate: selectedEvent.start.toISOString().split('T')[0],
      startTime: selectedEvent.allDay ? '' : selectedEvent.start.toTimeString().substring(0, 5),
      endDate: selectedEvent.end ? selectedEvent.end.toISOString().split('T')[0] : '',
      endTime: selectedEvent.allDay || !selectedEvent.end ? '' : selectedEvent.end.toTimeString().substring(0, 5),
      allDay: selectedEvent.allDay
    })
    setShowViewModal(false)
    setShowEditModal(true)
  }

  const formatEventDate = (date: Date, allDay: boolean) => {
    if (allDay) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <ProtectedRoute allowedRoles={["super admin", "admin"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Calendar
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Manage and track events and schedules
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => {
                  resetForm()
                  setShowAddModal(true)
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Add Event</span>
              </button>
            </div>
          </div>

          {/* Calendar Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                editable={true}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={true}
                weekends={true}
                events={events.map(event => ({
                  id: event.id,
                  title: event.title,
                  start: event.start,
                  end: event.end,
                  allDay: event.allDay,
                  backgroundColor: event.backgroundColor,
                  borderColor: event.borderColor,
                  textColor: event.textColor,
                  extendedProps: {
                    description: event.description,
                    location: event.location
                  }
                }))}
                select={handleDateSelect}
                eventClick={handleEventClick}
                eventChange={async (changeInfo) => {
                  const event = changeInfo.event
                  try {
                    const eventId = event.id
                    if (!eventId) return

                    const eventData = {
                      start: event.start!.toISOString(),
                      end: event.end ? event.end.toISOString() : undefined,
                      allDay: event.allDay || false
                    }

                    const response = await apiService.updateCalendarEvent(eventId.toString(), eventData) as any
                    
                    if (response.data?.success) {
                      toast.success('Event updated')
                      loadEvents() // Reload events from API
                    } else {
                      throw new Error(response.data?.message || 'Failed to update event')
                    }
                  } catch (error) {
                    console.error('Error updating event:', error)
                    toast.error('Failed to update event')
                    loadEvents() // Reload to revert changes
                  }
                }}
                height="auto"
                contentHeight="auto"
              />
            </div>
          </div>

          {/* Add Event Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add Event</h2>
                    <button
                      onClick={() => {
                        setShowAddModal(false)
                        resetForm()
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Event Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Enter event name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Event Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Enter event description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Event Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Enter event location"
                    />
                  </div>

                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.allDay}
                        onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">All Day</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    {!formData.allDay && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={formData.startTime}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    {!formData.allDay && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowAddModal(false)
                      resetForm()
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddEvent}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Event
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Event Modal */}
          {showEditModal && selectedEvent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Event</h2>
                    <button
                      onClick={() => {
                        setShowEditModal(false)
                        setSelectedEvent(null)
                        resetForm()
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Event Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Event Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Event Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.allDay}
                        onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">All Day</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    {!formData.allDay && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={formData.startTime}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    {!formData.allDay && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedEvent(null)
                      resetForm()
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditEvent}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Update Event
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View Event Modal */}
          {showViewModal && selectedEvent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedEvent.title}</h2>
                    <button
                      onClick={() => {
                        setShowViewModal(false)
                        setSelectedEvent(null)
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  {selectedEvent.description && (
                    <div className="flex items-start space-x-3">
                      <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</p>
                        <p className="text-gray-900 dark:text-white">{selectedEvent.description}</p>
                      </div>
                    </div>
                  )}

                  {selectedEvent.location && (
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Location</p>
                        <p className="text-gray-900 dark:text-white">{selectedEvent.location}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start space-x-3">
                    <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Start</p>
                      <p className="text-gray-900 dark:text-white">{formatEventDate(selectedEvent.start, selectedEvent.allDay)}</p>
                    </div>
                  </div>

                  {selectedEvent.end && (
                    <div className="flex items-start space-x-3">
                      <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">End</p>
                        <p className="text-gray-900 dark:text-white">{formatEventDate(selectedEvent.end, selectedEvent.allDay)}</p>
                      </div>
                    </div>
                  )}

                  {selectedEvent.allDay && (
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded">
                        All Day
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                  <button
                    onClick={handleDeleteEvent}
                    className="flex items-center space-x-2 px-4 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                  <button
                    onClick={openEditModal}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

