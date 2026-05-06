-- Run this in the Supabase SQL Editor
-- Creates the dashboard_notes table for the notepad feature

CREATE TABLE IF NOT EXISTS dashboard_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL,
  content    TEXT        NOT NULL,
  completed  BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE dashboard_notes ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own tenant's notes
CREATE POLICY "dashboard_notes_tenant_policy"
  ON dashboard_notes
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Index for fast per-tenant + date queries
CREATE INDEX IF NOT EXISTS dashboard_notes_tenant_date_idx
  ON dashboard_notes (tenant_id, created_at);
