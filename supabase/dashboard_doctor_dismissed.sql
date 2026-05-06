-- Run in Supabase SQL Editor
-- Tracks students manually dismissed from the "Μαθητές για γιατρό" dashboard widget

CREATE TABLE IF NOT EXISTS dashboard_doctor_dismissed (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL,
  student_id  UUID        NOT NULL,
  comment     TEXT,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id)
);

ALTER TABLE dashboard_doctor_dismissed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_doctor_dismissed_tenant_policy"
  ON dashboard_doctor_dismissed
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS dashboard_doctor_dismissed_tenant_idx
  ON dashboard_doctor_dismissed (tenant_id, student_id);
