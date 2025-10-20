-- Migration: Add email verification field to users table
-- Date: 2025
-- Description: Adds email_verified field to track email verification status

-- Add email_verified column (boolean flag for email verification)
ALTER TABLE users
ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER is_active;

-- Add index for performance on email verification queries
ALTER TABLE users
ADD INDEX idx_email_verified (email_verified);

-- Update existing Google OAuth users to be auto-verified
UPDATE users
SET email_verified = TRUE
WHERE auth_provider = 'google' OR auth_provider = 'local,google';