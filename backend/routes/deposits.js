const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const DepositRequest = require('../schemas/depositRequest');
const DepositChat = require('../schemas/depositChat');
const PaymentAdmin = require('../schemas/paymentAdmin');
const PaymentMethod = require('../schemas/paymentMethod');
const User = require('../schemas/users');

const { JWT_SECRET = 'change-me' } = process.env;

// Authenticate user
async function authenticateUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type === 'payment-admin') {
      return res.status(403).json({ error: 'Payment admin cannot access user routes' });
    }
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    req.userId = payload.sub;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Authenticate payment admin
async function authenticatePaymentAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'payment-admin') {
      return res.status(403).json({ error: 'Payment admin access required' });
    }
    const paymentAdmin = await PaymentAdmin.findById(payload.sub);
    if (!paymentAdmin || !paymentAdmin.isActive) {
      return res.status(403).json({ error: 'Payment admin not found or inactive' });
    }
    req.paymentAdmin = paymentAdmin;
    req.paymentAdminId = payload.sub;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Calculate coins based on amount
function calculateCoins(amount) {
  if (amount >= 200) {
    return Math.floor(amount * 110 * 1.2); // 20% extra above $200
  } else if (amount >= 100) {
    return Math.floor(amount * 100); // $100 = 10000 coins
  } else {
    return Math.floor(amount * 100); // $10 = 1000 coins
  }
}

// Get balanced payment admin assignment
async function getAssignedPaymentAdmin() {
  // Get all active payment admins
  const activePAs = await PaymentAdmin.find({ isActive: true }).select('_id');
  
  if (activePAs.length === 0) {
    throw new Error('No active payment administrators available');
  }

  // Count active requests per payment admin
  const requestCounts = await DepositRequest.aggregate([
    {
      $match: {
        status: { $in: ['pending', 'payment_details_sent', 'payment_pending'] },
      },
    },
    {
      $group: {
        _id: '$paymentAdminId',
        count: { $sum: 1 },
      },
    },
  ]);

  // Create map of counts
  const countMap = new Map();
  requestCounts.forEach((item) => {
    countMap.set(item._id.toString(), item.count);
  });

  // Find payment admin with minimum requests
  let minCount = Infinity;
  let assignedPA = null;

  for (const pa of activePAs) {
    const count = countMap.get(pa._id.toString()) || 0;
    if (count < minCount) {
      minCount = count;
      assignedPA = pa;
    }
  }

  return assignedPA._id;
}

// User: Create deposit request
router.post('/request', authenticateUser, async (req, res, next) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Minimum deposit amount is $10' });
    }

    // Calculate coins
    const coinsToAdd = calculateCoins(amount);

    // Get assigned payment admin
    const paymentAdminId = await getAssignedPaymentAdmin();

    // Create deposit request
    const depositRequest = await DepositRequest.create({
      userId: req.userId,
      paymentAdminId,
      requestedAmount: amount,
      coinsToAdd,
      status: 'pending',
    });

    // Send automated pricing message
    const pricingMessage = `💰 Deposit Request Created!\n\nAmount: $${amount}\nCoins to be added: ${coinsToAdd.toLocaleString()}\n\nPricing:\n• $10 = 1,000 coins\n• $100 = 10,000 coins\n• $200 = 22,000 coins\n• Above $200 = 20% extra coins\n\nA payment administrator will assist you shortly.`;

    await DepositChat.create({
      depositRequestId: depositRequest._id,
      senderId: depositRequest._id, // System message
      senderType: 'system',
      message: pricingMessage,
      messageType: 'pricing',
    });

    res.json({
      message: 'Deposit request created successfully',
      depositRequest,
      coinsToAdd,
    });
  } catch (error) {
    console.error('[Deposits] Error creating request:', error);
    next(error);
  }
});

// User: Get my deposit requests
router.get('/my-requests', authenticateUser, async (req, res, next) => {
  try {
    const requests = await DepositRequest.find({ userId: req.userId })
      .populate('paymentAdminId', 'name email')
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

// User: Get chat messages for a deposit request
router.get('/:requestId/chat', authenticateUser, async (req, res, next) => {
  try {
    const request = await DepositRequest.findById(req.params.requestId);
    
    if (!request || request.userId.toString() !== req.userId.toString()) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const messages = await DepositChat.find({
      depositRequestId: req.params.requestId,
    })
      .sort({ createdAt: 1 });

    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

// User: Send message
router.post('/:requestId/chat', authenticateUser, async (req, res, next) => {
  try {
    const { message, messageType = 'text' } = req.body;
    const request = await DepositRequest.findById(req.params.requestId);

    if (!request || request.userId.toString() !== req.userId.toString()) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status === 'closed' || request.status === 'approved') {
      return res.status(400).json({ error: 'Request is already closed or approved' });
    }

    // Filter contact details
    const contactPatterns = [
      /\b\d{10,}\b/g, // Phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails (but allow if it's part of payment)
      /\b(whatsapp|telegram|signal|discord|skype)\s*:?\s*\w+/gi,
    ];

    let filteredMessage = message;
    let isFiltered = false;

    for (const pattern of contactPatterns) {
      if (pattern.test(message)) {
        isFiltered = true;
        filteredMessage = message.replace(pattern, '[Contact details not allowed]');
      }
    }

    const chatMessage = await DepositChat.create({
      depositRequestId: req.params.requestId,
      senderId: req.userId,
      senderType: 'user',
      message: filteredMessage,
      messageType,
      isFiltered,
      originalMessage: isFiltered ? message : undefined,
    });

    res.json({ message: chatMessage });
  } catch (error) {
    next(error);
  }
});

// Payment Admin: Get assigned requests
router.get('/payment-admin/requests', authenticatePaymentAdmin, async (req, res, next) => {
  try {
    const requests = await DepositRequest.find({
      paymentAdminId: req.paymentAdminId,
      status: { $in: ['pending', 'payment_details_sent', 'payment_pending'] },
    })
      .populate('userId', 'account.displayName account.email')
      .sort({ createdAt: 1 });

    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

// Payment Admin: Get chat messages
router.get('/payment-admin/:requestId/chat', authenticatePaymentAdmin, async (req, res, next) => {
  try {
    const request = await DepositRequest.findById(req.params.requestId);
    
    if (!request || request.paymentAdminId.toString() !== req.paymentAdminId.toString()) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const messages = await DepositChat.find({
      depositRequestId: req.params.requestId,
    })
      .sort({ createdAt: 1 });

    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

// Payment Admin: Send payment details
router.post('/payment-admin/:requestId/send-payment-details', authenticatePaymentAdmin, async (req, res, next) => {
  try {
    const { paymentMethodId } = req.body;
    const request = await DepositRequest.findById(req.params.requestId);

    if (!request || request.paymentAdminId.toString() !== req.paymentAdminId.toString()) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const paymentMethod = await PaymentMethod.findById(paymentMethodId);
    if (!paymentMethod || !paymentMethod.isActive) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Format payment details message
    let detailsMessage = `💳 Payment Details:\n\nMethod: ${paymentMethod.name}\nType: ${paymentMethod.type}\n\n`;
    
    if (paymentMethod.type === 'upi') {
      detailsMessage += `UPI ID: ${paymentMethod.details.upiId}\n`;
      if (paymentMethod.details.qrCodeUrl) {
        detailsMessage += `QR Code: ${paymentMethod.details.qrCodeUrl}\n`;
      }
    } else if (paymentMethod.type === 'qr_code') {
      detailsMessage += `QR Code: ${paymentMethod.details.qrCodeUrl}\n`;
    } else if (paymentMethod.type === 'bank_transfer') {
      detailsMessage += `Account Number: ${paymentMethod.details.accountNumber}\n`;
      detailsMessage += `IFSC: ${paymentMethod.details.ifscCode}\n`;
      detailsMessage += `Bank: ${paymentMethod.details.bankName}\n`;
      detailsMessage += `Account Holder: ${paymentMethod.details.accountHolderName}\n`;
    } else if (paymentMethod.type === 'wallet') {
      detailsMessage += `Wallet Number: ${paymentMethod.details.walletNumber}\n`;
    }

    detailsMessage += `\nPlease make the payment of $${request.requestedAmount} and share the payment proof.`;

    await DepositChat.create({
      depositRequestId: request._id,
      senderId: req.paymentAdminId,
      senderType: 'payment_admin',
      message: detailsMessage,
      messageType: 'payment_details',
    });

    request.status = 'payment_details_sent';
    await request.save();

    res.json({ message: 'Payment details sent successfully' });
  } catch (error) {
    next(error);
  }
});

// Payment Admin: Send message
router.post('/payment-admin/:requestId/chat', authenticatePaymentAdmin, async (req, res, next) => {
  try {
    const { message } = req.body;
    const request = await DepositRequest.findById(req.params.requestId);

    if (!request || request.paymentAdminId.toString() !== req.paymentAdminId.toString()) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Filter contact details
    const contactPatterns = [
      /\b\d{10,}\b/g,
      /\b(whatsapp|telegram|signal|discord|skype)\s*:?\s*\w+/gi,
    ];

    let filteredMessage = message;
    let isFiltered = false;

    for (const pattern of contactPatterns) {
      if (pattern.test(message)) {
        isFiltered = true;
        filteredMessage = message.replace(pattern, '[Contact details not allowed]');
      }
    }

    const chatMessage = await DepositChat.create({
      depositRequestId: req.params.requestId,
      senderId: req.paymentAdminId,
      senderType: 'payment_admin',
      message: filteredMessage,
      messageType: 'text',
      isFiltered,
      originalMessage: isFiltered ? message : undefined,
    });

    res.json({ message: chatMessage });
  } catch (error) {
    next(error);
  }
});

// Payment Admin: Approve deposit
router.post('/payment-admin/:requestId/approve', authenticatePaymentAdmin, async (req, res, next) => {
  try {
    const { notes } = req.body;
    const request = await DepositRequest.findById(req.params.requestId);

    if (!request || request.paymentAdminId.toString() !== req.paymentAdminId.toString()) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status === 'approved') {
      return res.status(400).json({ error: 'Request already approved' });
    }

    // Update user wallet
    const user = await User.findById(request.userId);
    if (!user.wallet) {
      user.wallet = {
        walletId: User.generateWalletId(),
        balanceUsd: 0,
        partyCoins: 0,
      };
    }
    user.wallet.partyCoins = (user.wallet.partyCoins || 0) + request.coinsToAdd;
    await user.save();

    // Update request
    request.status = 'approved';
    request.notes = notes;
    await request.save();

    // Send system message
    await DepositChat.create({
      depositRequestId: request._id,
      senderId: request._id,
      senderType: 'system',
      message: `✅ Payment approved! ${request.coinsToAdd.toLocaleString()} coins have been added to your wallet.`,
      messageType: 'system',
    });

    res.json({ message: 'Deposit approved successfully', request });
  } catch (error) {
    next(error);
  }
});

// Payment Admin: Close request
router.post('/payment-admin/:requestId/close', authenticatePaymentAdmin, async (req, res, next) => {
  try {
    const request = await DepositRequest.findById(req.params.requestId);

    if (!request || request.paymentAdminId.toString() !== req.paymentAdminId.toString()) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status === 'approved') {
      return res.status(400).json({ error: 'Cannot close an approved request' });
    }

    request.status = 'closed';
    request.closedBy = 'payment_admin';
    request.closedAt = new Date();
    await request.save();

    await DepositChat.create({
      depositRequestId: request._id,
      senderId: request._id,
      senderType: 'system',
      message: '❌ This deposit request has been closed by the payment administrator.',
      messageType: 'system',
    });

    res.json({ message: 'Request closed successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

