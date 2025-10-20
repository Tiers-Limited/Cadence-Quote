// utils/verificationToken.js
const jwt = require('jsonwebtoken');

const generateVerificationToken = (userId, email) => {
  const payload = {
    userId,
    email,
    type: 'email_verification'
  };

  // Token expires in 24 hours
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
};

const verifyVerificationToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if it's an email verification token
    if (decoded.type !== 'email_verification') {
      throw new Error('Invalid token type');
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      valid: true
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, expired: true, error: 'Token has expired' };
    }
    return { valid: false, error: error.message };
  }
};

module.exports = {
  generateVerificationToken,
  verifyVerificationToken
};