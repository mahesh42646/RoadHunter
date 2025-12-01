const mongoose = require('mongoose');
const Admin = require('../schemas/admin');
require('dotenv').config();

async function createDefaultAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/partyverse');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@admin.com' });
    
    if (existingAdmin) {
      console.log('Default admin already exists');
      console.log('Email: admin@admin.com');
      console.log('To reset password, delete the admin and run this script again');
      process.exit(0);
    }

    // Create default admin
    const admin = await Admin.create({
      email: 'admin@admin.com',
      password: 'admin123', // Will be hashed automatically
      name: 'Administrator',
      isActive: true,
    });

    console.log('✅ Default admin created successfully!');
    console.log('Email: admin@admin.com');
    console.log('Password: admin123');
    console.log('⚠️  Please change the password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating default admin:', error);
    process.exit(1);
  }
}

createDefaultAdmin();

