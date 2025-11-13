const mongoose = require('mongoose');
const Role = require('../models/Role');

// Default roles configuration
const defaultRoles = [
  {
    name: 'Super Admin',
    permissions: [
      'user_management',
      'role_management', 
      'system_settings',
      'data_export',
      'content_moderation',
      'reports',
      'profile_edit',
      'view_content',
      'admin_panel',
      'user_creation',
      'user_deletion',
      'user_edit',
      'role_creation',
      'role_deletion',
      'role_edit',
      'support_tickets'
    ],
    color: '#DC2626',
    isActive: true,
    isSystem: true,
    createdBy: null // Will be set to system
  },
  {
    name: 'Admin',
    permissions: [
      'user_management',
      'role_management',
      'system_settings',
      'data_export',
      'content_moderation',
      'reports',
      'profile_edit',
      'view_content',
      'admin_panel',
      'user_creation',
      'user_edit',
      'role_edit',
      'support_tickets'
    ],
    color: '#7C3AED',
    isActive: true,
    isSystem: true,
    createdBy: null
  },
  {
    name: 'Publisher',
    permissions: [
      'profile_edit',
      'view_content',
      'reports'
    ],
    color: '#059669',
    isActive: true,
    isSystem: true,
    createdBy: null
  },
  {
    name: 'Advertiser',
    permissions: [
      'profile_edit',
      'view_content',
      'reports'
    ],
    color: '#2563EB',
    isActive: true,
    isSystem: true,
    createdBy: null
  },
  {
    name: 'Supportor',
    permissions: [
      'profile_edit',
      'view_content',
      'support_tickets'
    ],
    color: '#EA580C',
    isActive: true,
    isSystem: true,
    createdBy: null
  }
];

async function initializeRoles() {
  try {
    console.log('🚀 Initializing default roles...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alpuslinks');
    console.log('✅ Connected to MongoDB');

    // Create a system user ID for createdBy field
    const systemUserId = new mongoose.Types.ObjectId();

    for (const roleData of defaultRoles) {
        // Case-insensitive check if role already exists (idempotent)
        // Escape the role name for safe regex use
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const existingRole = await Role.findOne({ name: new RegExp(`^${escapeRegex(roleData.name)}$`, 'i') });
      
      if (existingRole) {
        console.log(`⚠️  Role '${roleData.name}' already exists, skipping...`);
        continue;
      }

      // Create new role
      const role = new Role({
        ...roleData,
        createdBy: systemUserId
      });

      await role.save();
      console.log(`✅ Created role: ${roleData.name}`);
    }

    console.log('🎉 All default roles initialized successfully!');
    
    // List all roles
    const allRoles = await Role.find({}).sort({ name: 1 });
    console.log('\n📋 Current roles in database:');
    allRoles.forEach(role => {
      console.log(`  - ${role.name} (${role.isActive ? 'Active' : 'Inactive'})`);
    });

  } catch (error) {
    console.error('❌ Error initializing roles:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  initializeRoles();
}

module.exports = { initializeRoles, defaultRoles };
