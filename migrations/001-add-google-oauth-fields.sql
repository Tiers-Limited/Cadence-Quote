-- Migration: Add Google OAuth fields to users table
-- Date: 2024
-- Description: Adds googleId and authProvider fields to support Google OAuth authentication

-- Add googleId column (unique identifier from Google)
ALTER TABLE users 
ADD COLUMN google_id VARCHAR(255) UNIQUE AFTER email,
ADD INDEX idx_google_id (google_id);

-- Add authProvider column (tracks authentication method)
ALTER TABLE users 
ADD COLUMN auth_provider VARCHAR(50) NOT NULL DEFAULT 'local' AFTER google_id;

-- Make password nullable (OAuth users don't need passwords)
ALTER TABLE users 
MODIFY COLUMN password VARCHAR(255) NULL;

-- Add comment for documentation
ALTER TABLE users 
COMMENT = 'User accounts with support for local and OAuth authentication';
