const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Role = require('../models/Role');
const LoginSession = require('../models/LoginSession');
const { sendPasswordResetEmail, sendTwoFactorCode } = require('../services/emailService');
const TwoFactorCode = require('../models/TwoFactorCode');
const SystemConfig = require('../models/SystemConfig');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Helper function to get Google OAuth client (lazy initialization)
const getGoogleOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }
  return new OAuth2Client(clientId);
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).populate('role', 'name permissions');
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(400).json({ message: 'Account is temporarily locked due to too many failed login attempts' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if 2FA is enabled for login
    const is2FAEnabledForLogin = await SystemConfig.getConfig('2fa_enabled_for_login', false);
    
    if (is2FAEnabledForLogin) {
      // Check if user is super admin - super admin bypasses 2FA
      const isSuperAdmin = user.role && (
        user.role.name === 'Super Admin' || 
        user.role.name === 'super admin' ||
        user.role.name === 'superadmin'
      );
      
      if (!isSuperAdmin) {
        // Auto-generate and send a 2FA code before responding
        try {
          const twoFactorCode = await TwoFactorCode.createCode(user.email, 'login');
          await sendTwoFactorCode(user.email, twoFactorCode.code);
        } catch (sendErr) {
          console.log('2FA pre-send failed, proceeding anyway:', sendErr?.message || sendErr);
        }

        // Inform client that 2FA is required
        return res.status(200).json({
          message: '2FA verification required',
          requires2FA: true,
          email: user.email
        });
      }
      // Super admin bypasses 2FA - continue with normal login
    }

    // If 2FA is not enabled for login, proceed with normal login
    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Create login session record
    const loginSession = new LoginSession({
      user: user._id,
      loginDate: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      loginMethod: 'email'
    });
    await loginSession.save();
    
    console.log(`✅ Login session created for user ${user.email} (${user._id})`);
    console.log(`📊 Session details:`, {
      sessionId: loginSession._id,
      userId: loginSession.user,
      loginDate: loginSession.loginDate,
      isActive: loginSession.isActive
    });

    // Create JWT token
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role?.name || 'user'
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '7d'
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('role').optional().isMongoId().withMessage('Please select a valid role'),
  body('phone').optional().trim(),
  body('location').optional().trim(),
  body('verificationCode').optional().isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, password, role, phone, location, verificationCode } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Check if 2FA is enabled for registration
    const is2FAEnabledForRegistration = await SystemConfig.getConfig('2fa_enabled_for_registration', false);
    
    if (is2FAEnabledForRegistration && verificationCode) {
      // Verify 2FA code for registration
      const twoFactorCode = await TwoFactorCode.findOne({
        email,
        purpose: 'register',
        isUsed: false,
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      if (!twoFactorCode) {
        return res.status(400).json({ message: 'Invalid or expired verification code' });
      }

      try {
        await twoFactorCode.verifyCode(verificationCode);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    }

    // Get default role (advertiser) if no role specified
    let selectedRole;
    if (role) {
      selectedRole = await Role.findOne({ _id: role, isActive: true });
      if (!selectedRole) {
        return res.status(400).json({ message: 'Invalid role selected' });
      }
    } else {
      // Use advertiser as default role
      selectedRole = await Role.findOne({ name: 'Advertiser', isActive: true });
      if (!selectedRole) {
        return res.status(400).json({ message: 'Default role not found. Please contact administrator.' });
      }
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      role: selectedRole._id,
      phone,
      location
    });

    await user.save();

    // Set lastLogin since user is automatically logged in after registration
    user.lastLogin = new Date();
    await user.save();

    // Populate role for response
    await user.populate('role', 'name permissions');

    // Create JWT token
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role?.name || 'user'
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '7d'
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        location: user.location,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({ 
        message: 'If an account with that email exists, we have sent a password reset link.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to user
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetTokenExpiry;
    await user.save();

    // Send password reset email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(user.email, resetLink);

    res.status(200).json({ 
      message: 'If an account with that email exists, we have sent a password reset link.' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Find user by reset token
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Set new password (model pre-save hook will hash it)
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // Also clear any login locks/attempts
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   GET /api/auth/verify-reset-token/:token
// @desc    Verify reset token
// @access  Public
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    res.status(200).json({ message: 'Token is valid' });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   POST /api/auth/google
// @desc    Authenticate user with Google OAuth
// @access  Public
router.post('/google', async (req, res) => {
  try {
    // Check if Google Client ID is configured
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('Google OAuth error: GOOGLE_CLIENT_ID is not configured');
      return res.status(500).json({ 
        message: 'Google OAuth is not configured. Please contact the administrator.',
        code: 'GOOGLE_NOT_CONFIGURED'
      });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Google token is required' });
    }

    // Get the Google Client ID
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      return res.status(500).json({ 
        message: 'Google OAuth is not configured. Please contact the administrator.',
        code: 'GOOGLE_NOT_CONFIGURED'
      });
    }

    console.log('🔍 Google OAuth Debug:', {
      configuredClientId: googleClientId,
      tokenLength: token?.length,
      tokenPreview: token?.substring(0, 20) + '...'
    });

    // Verify the Google token
    let ticket;
    try {
      const client = getGoogleOAuthClient();
      ticket = await client.verifyIdToken({
        idToken: token,
        audience: googleClientId,
      });
    } catch (verifyError) {
      console.error('Google token verification error:', verifyError);
      
      // Try to decode the token to see what audience it was issued for
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          console.error('🔍 Token payload (for debugging):', {
            tokenAudience: payload.aud,
            tokenIssuer: payload.iss,
            tokenEmail: payload.email,
            configuredClientId: googleClientId,
            match: payload.aud === googleClientId
          });
        }
      } catch (decodeError) {
        console.error('Could not decode token:', decodeError);
      }
      
      // Provide more specific error messages
      if (verifyError.message && verifyError.message.includes('Token used too early')) {
        return res.status(400).json({ 
          message: 'Token is not yet valid. Please try again.',
          code: 'TOKEN_TOO_EARLY'
        });
      }
      if (verifyError.message && verifyError.message.includes('Token used too late')) {
        return res.status(400).json({ 
          message: 'Token has expired. Please try logging in again.',
          code: 'TOKEN_EXPIRED'
        });
      }
      if (verifyError.message && verifyError.message.includes('Invalid token signature')) {
        return res.status(400).json({ 
          message: 'Invalid token. Please try logging in again.',
          code: 'INVALID_TOKEN'
        });
      }
      if (verifyError.message && (verifyError.message.includes('audience') || verifyError.message.includes('Wrong recipient'))) {
        return res.status(400).json({ 
          message: 'Token audience mismatch. The Google Client ID in frontend and backend must match. Please check your configuration.',
          code: 'AUDIENCE_MISMATCH',
          details: process.env.NODE_ENV === 'development' ? {
            error: verifyError.message,
            configuredClientId: googleClientId
          } : undefined
        });
      }
      
      return res.status(400).json({ 
        message: 'Failed to verify Google token. Please try again.',
        code: 'TOKEN_VERIFICATION_FAILED',
        details: process.env.NODE_ENV === 'development' ? verifyError.message : undefined
      });
    }

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ 
        message: 'Invalid token payload. Please try again.',
        code: 'INVALID_PAYLOAD'
      });
    }

    const { email, given_name, family_name, picture } = payload;
    
    if (!email) {
      return res.status(400).json({ 
        message: 'Email not found in Google account. Please ensure your Google account has an email address.',
        code: 'NO_EMAIL'
      });
    }

    // Check if user exists
    let user = await User.findOne({ email }).populate('role', 'name permissions');

    if (!user) {
      // Create new user with default role (publisher or advertiser)
      const defaultRole = await Role.findOne({ name: 'Publisher', isActive: true });
      
      if (!defaultRole) {
        return res.status(400).json({ message: 'Default role not found' });
      }

      user = new User({
        firstName: given_name,
        lastName: family_name,
        email: email,
        password: crypto.randomBytes(32).toString('hex'), // Random password since they'll use Google
        role: defaultRole._id,
        avatar: picture,
        isGoogleUser: true,
        status: 'active'
      });

      await user.save();
      
      // Set lastLogin since user is automatically logged in after Google OAuth registration
      user.lastLogin = new Date();
      await user.save();

      // Create login session record for new Google user
      const loginSession = new LoginSession({
        user: user._id,
        loginDate: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        loginMethod: 'google'
      });
      await loginSession.save();
      
      console.log(`✅ Google login session created for new user ${user.email} (${user._id})`);
      console.log(`📊 Session details:`, {
        sessionId: loginSession._id,
        userId: loginSession.user,
        loginDate: loginSession.loginDate,
        isActive: loginSession.isActive
      });
      
      await user.populate('role', 'name permissions');
    } else {
      // Update last login and avatar if needed
      user.lastLogin = new Date();
      if (picture && !user.avatar) {
        user.avatar = picture;
      }
      await user.save();

      // Create login session record for existing Google user
      const loginSession = new LoginSession({
        user: user._id,
        loginDate: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        loginMethod: 'google'
      });
      await loginSession.save();
      
      console.log(`✅ Google login session created for existing user ${user.email} (${user._id})`);
      console.log(`📊 Session details:`, {
        sessionId: loginSession._id,
        userId: loginSession.user,
        loginDate: loginSession.loginDate,
        isActive: loginSession.isActive
      });
    }

    // Create JWT token
    const jwtPayload = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role?.name || 'user'
      }
    };

    const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '7d'
    });

    res.json({
      message: 'Google login successful',
      token: jwtToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    
    // Provide more detailed error messages
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      return res.status(500).json({ 
        message: 'Database error occurred. Please try again later.',
        code: 'DATABASE_ERROR'
      });
    }
    
    if (error.message && error.message.includes('role')) {
      return res.status(400).json({ 
        message: 'Failed to assign user role. Please contact support.',
        code: 'ROLE_ERROR'
      });
    }
    
    res.status(500).json({ 
      message: 'An unexpected error occurred. Please try again.',
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current authenticated user
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('role', 'name permissions');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('role', 'name permissions');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.status === 'inactive') {
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // Create new JWT token
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role?.name || 'user'
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '7d'
    });

    res.json({
      message: 'Token refreshed successfully',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/switch-role
// @desc    Switch user role between publisher and advertiser
// @access  Private
router.post('/switch-role', authMiddleware, [
  body('targetRole').isIn(['publisher', 'advertiser']).withMessage('Target role must be either publisher or advertiser')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { targetRole } = req.body;
    const user = await User.findById(req.userId).populate('role', 'name permissions');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get current role name
    const currentRoleName = user.role?.name?.toLowerCase();
    
    // Check if user is already in the target role
    if (currentRoleName === targetRole.toLowerCase()) {
      return res.status(400).json({ message: `User is already a ${targetRole}` });
    }

    // Find the target role
    const targetRoleDoc = await Role.findOne({ 
      name: { $regex: new RegExp(targetRole, 'i') },
      isActive: true 
    });
    
    if (!targetRoleDoc) {
      return res.status(400).json({ message: `Role '${targetRole}' not found or inactive` });
    }

    // Update user's role
    user.role = targetRoleDoc._id;
    await user.save();
    await user.populate('role', 'name permissions');

    // Create new JWT token with updated role
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role.name
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '7d'
    });

    res.json({
      message: `Role switched to ${targetRole} successfully`,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Switch role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/send-2fa-code
// @desc    Send 2FA verification code to user's email
// @access  Public
router.post('/send-2fa-code', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('purpose').optional().isIn(['login', 'register', 'password_reset']).withMessage('Invalid purpose')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, purpose = 'login' } = req.body;

    console.log('📧 Sending 2FA code to:', email, 'for purpose:', purpose);
    
    // For login purpose, verify user exists first
    if (purpose === 'login') {
      const user = await User.findOne({ email });
      if (!user) {
        console.log('❌ User not found for email:', email);
        return res.status(400).json({ message: 'User not found' });
      }
      console.log('✅ User found:', user.email, 'Status:', user.status);
    }
    
    // Create 2FA code
    const twoFactorCode = await TwoFactorCode.createCode(email, purpose);
    console.log('🔐 2FA code created:', twoFactorCode.code);

    // Send email
    const emailSent = await sendTwoFactorCode(email, twoFactorCode.code);

    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send verification code' });
    }

    res.json({
      message: 'Verification code sent successfully',
      expiresIn: 600 // 10 minutes in seconds
    });
  } catch (error) {
    console.error('Send 2FA code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/verify-2fa-code
// @desc    Verify 2FA code and complete authentication
// @access  Public
router.post('/verify-2fa-code', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
  body('purpose').optional().isIn(['login', 'register', 'password_reset']).withMessage('Invalid purpose')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, code, purpose = 'login' } = req.body;

    console.log('🔍 Verifying 2FA code for:', email, 'code:', code, 'purpose:', purpose);

    // Find the 2FA code
    const twoFactorCode = await TwoFactorCode.findOne({
      email,
      purpose,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    console.log('🔐 2FA code found:', twoFactorCode ? 'Yes' : 'No');

    if (!twoFactorCode) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Verify the code
    try {
      await twoFactorCode.verifyCode(code);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    // For login purpose, find user and create session
    if (purpose === 'login') {
      console.log('🔍 Looking for user with email:', email);
      const user = await User.findOne({ email }).populate('role', 'name permissions');
      console.log('👤 User found:', user ? 'Yes' : 'No');
      if (user) {
        console.log('👤 User details:', { email: user.email, role: user.role?.name, status: user.status });
      }
      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(400).json({ message: 'Account is temporarily locked' });
      }

      // Reset login attempts on successful verification
      await user.resetLoginAttempts();

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Create login session record
      const loginSession = new LoginSession({
        user: user._id,
        loginDate: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        loginMethod: 'email_2fa'
      });
      await loginSession.save();
      
      console.log(`✅ 2FA login session created for user ${user.email} (${user._id})`);
      console.log(`📊 Session details:`, {
        sessionId: loginSession._id,
        userId: loginSession.user,
        loginDate: loginSession.loginDate,
        isActive: loginSession.isActive
      });

      // Create JWT token
      const payload = {
        user: {
          id: user._id,
          email: user.email,
          role: user.role?.name || 'user'
        }
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
        expiresIn: '7d'
      });

      res.json({
        message: '2FA verification successful',
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          status: user.status,
          avatar: user.avatar,
          lastLogin: user.lastLogin
        }
      });
    } else if (purpose === 'register') {
      // For registration purpose, just verify the code is valid
      // The actual user creation will be handled by the frontend
      res.json({
        message: '2FA verification successful for registration',
        verified: true,
        email: email
      });
    } else {
      // For other purposes (like password_reset), just return success
      res.json({
        message: '2FA verification successful',
        verified: true
      });
    }
  } catch (error) {
    console.error('Verify 2FA code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/system-config
// @desc    Get system configuration
// @access  Private (Admin only)
router.get('/system-config', authMiddleware, async (req, res) => {
  try {
    // Check if user has admin permissions
    const user = await User.findById(req.userId).populate('role', 'name permissions');
    if (!user || !user.role || !user.role.permissions.includes('system_settings')) {
      return res.status(403).json({ message: 'Access denied. Admin permissions required.' });
    }

    const configs = await SystemConfig.find({ isActive: true });
    const configObject = {};
    configs.forEach(config => {
      configObject[config.key] = {
        value: config.value,
        description: config.description,
        category: config.category
      };
    });

    res.json({
      message: 'System configuration retrieved successfully',
      config: configObject
    });
  } catch (error) {
    console.error('Get system config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/system-config
// @desc    Update system configuration
// @access  Private (Admin only)
router.put('/system-config', authMiddleware, [
  body('key').notEmpty().withMessage('Configuration key is required'),
  body('value').notEmpty().withMessage('Configuration value is required'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user has admin permissions
    const user = await User.findById(req.userId).populate('role', 'name permissions');
    if (!user || !user.role || !user.role.permissions.includes('system_settings')) {
      return res.status(403).json({ message: 'Access denied. Admin permissions required.' });
    }

    const { key, value, description = '', category = 'general' } = req.body;

    const config = await SystemConfig.setConfig(key, value, description, user._id);
    if (category !== 'general') {
      config.category = category;
      await config.save();
    }

    res.json({
      message: 'System configuration updated successfully',
      config: {
        key: config.key,
        value: config.value,
        description: config.description,
        category: config.category
      }
    });
  } catch (error) {
    console.error('Update system config error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user and update session
// @access  Private
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    console.log('Logout request for user:', req.userId);
    
    // Check for active sessions first
    const activeSessions = await LoginSession.find({
      user: req.userId,
      isActive: true
    });
    
    console.log('Active sessions found:', activeSessions.length);
    console.log('Session details:', activeSessions.map(s => ({
      id: s._id,
      loginDate: s.loginDate,
      isActive: s.isActive
    })));
    
    // Update ALL active sessions for this user (not just the most recent one)
    const result = await LoginSession.updateMany(
      { 
        user: req.userId, 
        isActive: true 
      },
      { 
        isActive: false, 
        logoutDate: new Date() 
      }
    );
    
    console.log('Logout result:', result.modifiedCount, 'sessions deactivated');

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;