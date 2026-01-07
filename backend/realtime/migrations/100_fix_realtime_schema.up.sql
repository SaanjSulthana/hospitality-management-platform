-- Migration 100: Fix Realtime Schema (Force Run)
-- This migration ensures chat_messages tables exist
-- Logic taken from migration 1 which was likely skipped

-- Create chat messages table
-- Note: Using Postgres syntax. The original migration used MySQL/Index syntax (INDEX inside CREATE TABLE),
-- but Encore/Postgres usually splits these.
-- However, I'll try to stick to standard Postgres.

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(255) NOT NULL,
  user_id INTEGER NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  org_id INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_org_id ON chat_messages(org_id);

-- Create chat message reads table (for read receipts)
CREATE TABLE IF NOT EXISTS chat_message_reads (
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_reads_user_id ON chat_message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_read_at ON chat_message_reads(read_at);

-- Create index for unread messages query
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread 
  ON chat_messages(room_id, created_at) 
  WHERE NOT EXISTS (
    SELECT 1 FROM chat_message_reads 
    WHERE chat_message_reads.message_id = chat_messages.id
  );
