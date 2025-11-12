/*
  # Create Google Calendar Tokens Table

  1. New Tables
    - `google_calendar_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `access_token` (text, encrypted storage for access token)
      - `refresh_token` (text, encrypted storage for refresh token)
      - `expires_at` (timestamptz, when the access token expires)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `google_calendar_tokens` table
    - Add policy for users to read/update only their own tokens
*/

CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own calendar tokens"
  ON google_calendar_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar tokens"
  ON google_calendar_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar tokens"
  ON google_calendar_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar tokens"
  ON google_calendar_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
