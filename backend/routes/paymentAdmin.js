const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const PaymentAdmin = require('../schemas/paymentAdmin');

const { JWT_SECRET = 'change-me' } = process.env;

// Payment Admin login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find payment admin by email
    const paymentAdmin = await PaymentAdmin.findOne({ email: email.toLowerCase().trim() });

    if (!paymentAdmin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if payment admin is active
    if (!paymentAdmin.isActive) {
      return res.status(403).json({ error: 'Payment administrator account is deactivated' });
    }

    // Verify password
    const isPasswordValid = await paymentAdmin.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    try {
      paymentAdmin.lastLogin = new Date();
      await paymentAdmin.save();
    } catch (saveError) {
      console.error('[Payment Admin Login] Error saving last login:', saveError);
    }

    // Generate JWT token for payment admin (separate from admin and user tokens)
    let token;
    try {
      token = jwt.sign(
        { 
          sub: paymentAdmin._id.toString(), 
          email: paymentAdmin.email,
          type: 'payment-admin' // Distinguish payment admin tokens
        },
        JWT_SECRET,
        { expiresIn: '10y' } // 10 years - effectively never expires
      );
    } catch (tokenError) {
      console.error('[Payment Admin Login] Error generating token:', tokenError);
      return res.status(500).json({ error: 'Failed to generate authentication token' });
    }

    // Prepare response data
    const responseData = {
      message: 'Login successful',
      token,
      paymentAdmin: {
        _id: paymentAdmin._id,
        email: paymentAdmin.email,
        name: paymentAdmin.name,
      },
    };

    res.json(responseData);
  } catch (error) {
    console.error('[Payment Admin Login] Unexpected error:', error);
    next(error);
  }
});

// Middleware to verify payment admin authentication
async function authenticatePaymentAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    
    // Verify token is payment admin type
    if (payload.type !== 'payment-admin') {
      return res.status(403).json({ error: 'Payment administrator access required' });
    }
    
    // Verify payment admin exists and is active
    const paymentAdmin = await PaymentAdmin.findById(payload.sub);
    if (!paymentAdmin || !paymentAdmin.isActive) {
      return res.status(403).json({ error: 'Payment administrator account not found or inactive' });
    }
    
    req.paymentAdmin = paymentAdmin;
    req.paymentAdminId = payload.sub;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Get dashboard overview
router.get('/dashboard', authenticatePaymentAdmin, async (req, res, next) => {
  try {
    const DepositRequest = require('../schemas/depositRequest');
    
    const totalRequests = await DepositRequest.countDocuments({
      paymentAdminId: req.paymentAdminId,
    });
    
    const pendingRequests = await DepositRequest.countDocuments({
      paymentAdminId: req.paymentAdminId,
      status: { $in: ['pending', 'payment_details_sent', 'payment_pending'] },
    });
    
    const completedRequests = await DepositRequest.countDocuments({
      paymentAdminId: req.paymentAdminId,
      status: 'approved',
    });
    
    const totalRevenue = await DepositRequest.aggregate([
      {
        $match: {
          paymentAdminId: req.paymentAdminId,
          status: 'approved',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$requestedAmount' },
        },
      },
    ]);
    
    res.json({
      message: 'Payment Administrator Dashboard',
      overview: {
        totalTransactions: totalRequests,
        pendingPayments: pendingRequests,
        completedPayments: completedRequests,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get available payment methods
router.get('/payment-methods', authenticatePaymentAdmin, async (req, res, next) => {
  try {
    const PaymentMethod = require('../schemas/paymentMethod');
    const paymentMethods = await PaymentMethod.find({ isActive: true })
      .select('-addedBy')
      .sort({ createdAt: -1 });
    
    res.json({ paymentMethods });
  } catch (error) {
    next(error);
  }
});

// Export authenticatePaymentAdmin for use in other routes if needed
router.authenticatePaymentAdmin = authenticatePaymentAdmin;

module.exports = router;

