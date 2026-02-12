// controllers/clientAuthController.js
// Handles client authentication for customer portal access

const Client = require('../models/Client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { generateToken } = require('../middleware/auth');
const emailService = require('../services/emailService');
const { createAuditLog } = require('./auditLogController');

/**
 * Client login
 * POST /api/client-auth/login
 */
exports.clientLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find client by email
        const client = await Client.findOne({
            where: {
                email: email.toLowerCase(),
                isActive: true
            }
        });

        if (!client) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if client has portal access
        if (!client.hasPortalAccess) {
            console.log('Client portal access not granted for:', client.email);
            return res.status(403).json({
                success: false,
                message: 'Invalid Credentials. Please try again.'
                // message: 'Portal access not granted. Please contact your contractor.'
            });
        }

        // Check if password is set
        if (!client.password) {
            console.log('Client password not set for:', client.email);
            return res.status(400).json({
                success: false,
                message: 'Invalid Credentials. Please try again.'
                // message: 'Password not set. Please use the invitation link sent to your email to set your password.'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, client.password);
        if (!isPasswordValid) {
            console.log('Invalid password attempt for:', client.email);
            return res.status(401).json({
                success: false,
                message: 'Invalid Credentials. Please try again.'
            });
        }

        // Update last login
        await client.update({
            lastLoginAt: new Date()
        });

        // Generate JWT token for client (pass clientId as userId with isClient flag)
        // Generate enriched JWT token for client
        const token = generateToken(
            {
                id: client.id,
                role: 'customer',
                fullName: client.name,
                email: client.email
            },
            client.tenant || { id: client.tenantId, companyName: 'Client Portal' },
            '7d'
        );
        // Add isClient flag to payload via a wrapper for now to preserve specific client logic
        const decoded = jwt.decode(token);
        decoded.isClient = true;
        decoded.clientId = client.id;
        const finalToken = jwt.sign(decoded, process.env.JWT_SECRET);

        // Create audit log
        await createAuditLog({
            userId: null, // Client action, not a User
            tenantId: client.tenantId,
            action: 'client_login',
            category: 'auth',
            entityType: 'Client',
            entityId: client.id,
            metadata: {
                clientId: client.id,
                clientEmail: client.email,
                clientName: client.name
            },
            req
        });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token: finalToken,
                user: {
                    id: client.id,
                    name: client.name,
                    email: client.email,
                    phone: client.phone,
                    role: 'customer',
                    hasPortalAccess: client.hasPortalAccess
                }
            }
        });
    } catch (error) {
        console.error('Client login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

/**
 * Send portal invitation to client
 * POST /api/client-auth/invite
 * Contractor-only endpoint
 */
exports.inviteClient = async (req, res) => {
    try {
        const { clientId } = req.body;
        const contractorId = req.user.id;

        // Find client
        const client = await Client.findOne({
            where: {
                id: clientId,
                tenantId: req.user.tenantId
            }
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found'
            });
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date();
        tokenExpiry.setHours(tokenExpiry.getHours() + 72); // 72 hours validity

        // Update client
        await client.update({
            hasPortalAccess: true,
            verificationToken,
            verificationTokenExpiry: tokenExpiry,
            portalInvitedAt: new Date()
        });

        // Send invitation email
        const invitationLink = `${process.env.FRONTEND_URL}/client/set-password?token=${verificationToken}`;

        try {
            await emailService.sendClientInvitationEmail(client.email, {
                clientName: client.name,
                contractorName: req.user.fullName,
                invitationLink,
                expiryHours: 72
            });
        } catch (emailError) {
            console.error('Failed to send invitation email:', emailError);
            return res.status(500).json({
                success: false,
                message: 'Failed to send invitation email'
            });
        }

        // Create audit log
        await createAuditLog({
            userId: contractorId,
            tenantId: req.user.tenantId,
            action: 'client_invited',
            category: 'auth',
            entityType: 'Client',
            entityId: client.id,
            metadata: {
                clientId: client.id,
                clientEmail: client.email,
                clientName: client.name,
                contractorName: req.user.fullName
            },
            req
        });

        res.json({
            success: true,
            message: 'Invitation sent successfully',
            data: {
                clientId: client.id,
                invitedAt: client.portalInvitedAt
            }
        });
    } catch (error) {
        console.error('Invite client error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send invitation',
            error: error.message
        });
    }
};

/**
 * Set password using invitation token
 * POST /api/client-auth/set-password
 */
exports.setPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: 'Token and password are required'
            });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        // Find client by token
        const client = await Client.findOne({
            where: {
                verificationToken: token,
                isActive: true
            }
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired invitation link'
            });
        }

        // Check token expiry
        if (new Date() > client.verificationTokenExpiry) {
            return res.status(400).json({
                success: false,
                message: 'Invitation link has expired. Please request a new one.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update client
        await client.update({
            password: hashedPassword,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            portalActivatedAt: new Date(),
            verificationToken: null,
            verificationTokenExpiry: null
        });

        // Generate enriched auth token for client
        const authToken = generateToken(
            { id: client.id, role: 'customer', fullName: client.name, email: client.email },
            { id: client.tenantId, companyName: 'Client Portal' },
            '7d'
        );
        const decoded = jwt.decode(authToken);
        decoded.isClient = true;
        decoded.clientId = client.id;
        const finalAuthToken = jwt.sign(decoded, process.env.JWT_SECRET);

        // Create audit log
        await createAuditLog({
            userId: null, // Client action, not a User
            tenantId: client.tenantId,
            action: 'client_password_set',
            category: 'auth',
            entityType: 'Client',
            entityId: client.id,
            metadata: {
                clientId: client.id,
                clientEmail: client.email,
                clientName: client.name
            },
            req
        });

        res.json({
            success: true,
            message: 'Password set successfully. You can now login.',
            data: {
                token: finalAuthToken,
                user: {
                    id: client.id,
                    name: client.name,
                    email: client.email,
                    role: 'customer'
                }
            }
        });
    } catch (error) {
        console.error('Set password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to set password',
            error: error.message
        });
    }
};

/**
 * Request password reset
 * POST /api/client-auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const client = await Client.findOne({
            where: {
                email: email.toLowerCase(),
                isActive: true
            }
        });

        if (!client) {
            // Don't reveal if email exists
            return res.json({
                success: true,
                message: 'If an account exists with this email, a password reset link has been sent.'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date();
        resetExpiry.setHours(resetExpiry.getHours() + 24); // 24 hours validity

        await client.update({
            passwordResetToken: resetToken,
            passwordResetExpiry: resetExpiry
        });

        // Send reset email
        const resetLink = `${process.env.FRONTEND_URL}/client/reset-password?token=${resetToken}`;

        try {
            await emailService.sendClientPasswordResetEmail(client.email, {
                clientName: client.name,
                resetLink,
                expiryHours: 24
            });
        } catch (emailError) {
            console.error('Failed to send reset email:', emailError);
        }

        res.json({
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process request',
            error: error.message
        });
    }
};

/**
 * Reset password using reset token
 * POST /api/client-auth/reset-password
 */
exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: 'Token and password are required'
            });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        const client = await Client.findOne({
            where: {
                passwordResetToken: token,
                isActive: true
            }
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired reset link'
            });
        }

        // Check token expiry
        if (new Date() > client.passwordResetExpiry) {
            return res.status(400).json({
                success: false,
                message: 'Reset link has expired. Please request a new one.'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update client
        await client.update({
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpiry: null
        });

        // Create audit log
        await createAuditLog({
            userId: null, // Client action, not a User
            tenantId: client.tenantId,
            action: 'client_password_reset',
            category: 'auth',
            entityType: 'Client',
            entityId: client.id,
            metadata: {
                clientId: client.id,
                clientEmail: client.email,
                clientName: client.name
            },
            req
        });

        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password',
            error: error.message
        });
    }
};

/**
 * Resend invitation email
 * POST /api/client-auth/resend-invitation
 */
exports.resendInvitation = async (req, res) => {
    try {
        const { clientId } = req.body;

        const client = await Client.findOne({
            where: {
                id: clientId,
                tenantId: req.user.tenantId,
                hasPortalAccess: true
            }
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found or access not granted'
            });
        }

        // Generate new verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date();
        tokenExpiry.setHours(tokenExpiry.getHours() + 72);

        await client.update({
            verificationToken,
            verificationTokenExpiry: tokenExpiry,
            portalInvitedAt: new Date()
        });

        // Send invitation email
        const invitationLink = `${process.env.FRONTEND_URL}/client/set-password?token=${verificationToken}`;

        await emailService.sendClientInvitationEmail(client.email, {
            clientName: client.name,
            contractorName: req.user.fullName,
            invitationLink,
            expiryHours: 72
        });

        res.json({
            success: true,
            message: 'Invitation resent successfully'
        });
    } catch (error) {
        console.error('Resend invitation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend invitation',
            error: error.message
        });
    }
};

/**
 * Validate password reset token
 * GET /api/client-auth/validate-reset-token
 */
exports.validateResetToken = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Reset token is required'
            });
        }

        // Find client with this reset token
        const client = await Client.findOne({
            where: {
                passwordResetToken: token,
                isActive: true
            }
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Invalid reset token'
            });
        }

        // Check if token has expired
        if (client.passwordResetTokenExpiry && new Date() > client.passwordResetTokenExpiry) {
            return res.status(400).json({
                success: false,
                message: 'Reset token has expired. Please request a new one.'
            });
        }

        res.json({
            success: true,
            message: 'Token is valid'
        });
    } catch (error) {
        console.error('Validate reset token error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate token',
            error: error.message
        });
    }
};

module.exports = exports;
