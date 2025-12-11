const mongoose = require('mongoose');
const Admin = require('../schemas/admin');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function createAdmin() {
  try {
    // Get MongoDB URI from environment or use provided one
    // For live server, you can pass it as: MONGODB_URI=mongodb://your-server:27017/social-gaming-platform node createAdmin.js
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-gaming-platform';
    
    console.log('Connecting to MongoDB:', mongoUri.replace(/\/\/.*@/, '//***@')); // Hide credentials in log
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Admin credentials
    const adminEmail = 'darkunde@gmail.com';
    const adminPassword = 'pass@123';
    const adminName = 'Admin';

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: adminEmail.toLowerCase().trim() });
    
    if (existingAdmin) {
      console.log('⚠️  Admin with this email already exists');
      console.log(`Email: ${adminEmail}`);
      console.log('To update password, delete the admin first and run this script again');
      process.exit(0);
    }

    // Create admin
    const admin = await Admin.create({
      email: adminEmail.toLowerCase().trim(),
      password: adminPassword, // Will be hashed automatically by the schema
      name: adminName,
      isActive: true,
    });

    console.log('\n✅ Admin created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Please change the password after first login!');
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    if (error.code === 11000) {
      console.error('Admin with this email already exists');
    }
    process.exit(1);
  }
}

createAdmin();

