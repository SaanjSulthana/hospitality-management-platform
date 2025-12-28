-- Quick Fix Script for Staging Database Schema
-- Run this SQL directly in Encore Cloud Console SQL Editor for staging environment
-- This script adds all missing columns to expenses and revenues tables

-- ============================================================================
-- EXPENSES TABLE - Add Missing Columns
-- ============================================================================

-- Fix expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);

-- ============================================================================
-- REVENUES TABLE - Add Missing Columns
-- ============================================================================

-- Fix revenues table  
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash';
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);

-- ============================================================================
-- Update existing records with default values
-- ============================================================================

UPDATE expenses SET status = 'pending' WHERE status IS NULL;
UPDATE revenues SET status = 'pending' WHERE status IS NULL;

