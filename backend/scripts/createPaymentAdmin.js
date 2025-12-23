const mongoose = require('mongoose');
const PaymentAdmin = require('../schemas/paymentAdmin');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function createPaymentAdmin() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-gaming-platform';
    
    console.log('Connecting to MongoDB:', mongoUri.replace(/\/\/.*@/, '//***@'));
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const paymentAdminEmail = 'mahesh@darkunde.in';
    const paymentAdminPassword = 'mahesh@890';
    const paymentAdminName = 'Payment Administrator';

    const existingPaymentAdmin = await PaymentAdmin.findOne({ email: paymentAdminEmail.toLowerCase().trim() });
    
    if (existingPaymentAdmin) {
      console.log('⚠️  Payment Administrator with this email already exists');
      console.log(`Email: ${paymentAdminEmail}`);
      console.log('To update password, delete the payment admin first and run this script again');
      process.exit(0);
    }

    const paymentAdmin = await PaymentAdmin.create({
      email: paymentAdminEmail.toLowerCase().trim(),
      password: paymentAdminPassword,
      name: paymentAdminName,
      isActive: true,
    });

    console.log('\n✅ Payment Administrator created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${paymentAdminEmail}`);
    console.log(`Password: ${paymentAdminPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Please change the password after first login!');
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating payment administrator:', error.message);
    if (error.code === 11000) {
      console.error('Payment Administrator with this email already exists');
    }
    process.exit(1);
  }
}

createPaymentAdmin();

