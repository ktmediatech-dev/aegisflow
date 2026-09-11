-- TOTP-based 2FA for platform admins only (company users are unaffected).
-- totp_secret stays NULL until setup is completed and verified;
-- totp_enabled gates whether login actually requires a second step.
-- Backup codes are stored bcrypt-hashed, one-time-use, same as passwords.
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64);
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS totp_backup_codes JSONB NOT NULL DEFAULT '[]';
