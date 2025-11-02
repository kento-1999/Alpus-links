// Suppress deprecation warnings
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('util._extend')) {
    // Suppress the specific util._extend deprecation warning
    return;
  }
  console.warn(warning);
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
try {
  const result = dotenv.config({ path: path.join(__dirname, '.env') });
  console.log('Environment variables loaded successfully');
  console.log('Dotenv result:', result);
  console.log('JWT_SECRET from .env:', process.env.JWT_SECRET ? 'Found' : 'Not found');
  
  // Manual fallback if dotenv fails
  if (!process.env.JWT_SECRET) {
    console.log('Dotenv failed, trying manual load...');
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const envLines = envContent.split('\n');
    envLines.forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
    console.log('Manual load - JWT_SECRET:', process.env.JWT_SECRET ? 'Found' : 'Not found');
  }
} catch (e) {
  console.warn('Warning: failed to load environment file:', e.message);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Debug environment variables
console.log('Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'undefined');

// Security middleware with COOP configuration for OAuth
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://oauth2.googleapis.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
    },
  },
}));
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://192.168.138.120:3000',
    'http://alpuslinks.net:3000',
    'http://alpuslinks.net'
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs (increased for development)
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/blog-management')
.then(() => {})
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/user-meta', require('./routes/userMeta'));
app.use('/api/websites', require('./routes/websites'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/link-insertions', require('./routes/linkInsertions'));
app.use('/api/domain-verification', require('./routes/domainVerification'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/calendar', require('./routes/calendar'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
});
