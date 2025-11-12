/*
  # Add Google Calendar Integration Column

  1. Changes
    - Add `google_calendar_event_id` column to `tasks` table to store the Google Calendar event ID for synced tasks
  
  2. Notes
    - Column is nullable to support tasks that haven't been synced yet
    - Uses TEXT type to store Google Calendar event IDs (which are strings)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'google_calendar_event_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN google_calendar_event_id TEXT DEFAULT NULL;
  END IF;
END $$;
