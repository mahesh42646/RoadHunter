const mongoose = require('mongoose');
const Admin = require('../schemas/admin');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function seedAdmin() {
  try {
    // Get MongoDB URI from environment or use provided one
    // Usage: MONGODB_URI=mongodb://your-server:27017/social-gaming-platform node scripts/seedAdmin.js
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-gaming-platform';
    
    console.log('Connecting to MongoDB:', mongoUri.replace(/\/\/.*@/, '//***@')); // Hide credentials in log
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Admin credentials
    const adminEmail = 'darkunde@gmail.com';
    const adminPassword = 'pass@123';
    const adminName = 'Admin';

    // Delete existing admin with this email
    const deletedAdmin = await Admin.findOneAndDelete({ email: adminEmail.toLowerCase().trim() });
    
    if (deletedAdmin) {
      console.log('🗑️  Deleted existing admin:', adminEmail);
    } else {
      console.log('ℹ️  No existing admin found with email:', adminEmail);
    }

    // Create new admin
    const admin = await Admin.create({
      email: adminEmail.toLowerCase().trim(),
      password: adminPassword, // Will be hashed automatically by the schema
      name: adminName,
      isActive: true,
    });

    console.log('\n✅ Admin seeded successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Please change the password after first login!');
    console.log('\n');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
    if (error.code === 11000) {
      console.error('Admin with this email already exists (should have been deleted)');
    }
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedAdmin();
