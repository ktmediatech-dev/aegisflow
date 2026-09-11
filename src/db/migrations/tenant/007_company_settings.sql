-- Self-service branding, set by the company's own IT Admin (not the
-- platform admin) — display name, logo, contact email, and a preset
-- theme. Singleton row (fixed id), created on first read if missing.
CREATE TABLE IF NOT EXISTS company_settings (
  id             UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  company_name   VARCHAR(255),
  logo_data_uri  TEXT, -- small logo image, stored inline (data: URI) — no file storage service configured yet
  contact_email  VARCHAR(255),
  theme          VARCHAR(20) NOT NULL DEFAULT 'dark',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
