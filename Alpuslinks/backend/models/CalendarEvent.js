const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  start: {
    type: Date,
    required: [true, 'Start date is required'],
    index: true
  },
  end: {
    type: Date,
    required: false,
    validate: {
      validator: function(value) {
        return !value || value >= this.start;
      },
      message: 'End date must be after or equal to start date'
    }
  },
  allDay: {
    type: Boolean,
    default: false
  },
  backgroundColor: {
    type: String,
    default: '#3b82f6' // Default blue color
  },
  borderColor: {
    type: String,
    default: '#3b82f6'
  },
  textColor: {
    type: String,
    default: '#ffffff'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
calendarEventSchema.index({ start: 1, end: 1 });
calendarEventSchema.index({ createdBy: 1, start: 1 });
calendarEventSchema.index({ start: 1, end: 1, allDay: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);

