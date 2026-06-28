-- Add user management fields for GDPR compliance and admin controls

-- Add blocked status and email preferences to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_opt_out_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Create registration rate limiting table
CREATE TABLE IF NOT EXISTS registration_limits (
  date DATE PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  max_registrations INTEGER NOT NULL DEFAULT 100
);

-- Create audit log for user actions
CREATE TABLE IF NOT EXISTS user_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for audit log queries
CREATE INDEX IF NOT EXISTS idx_user_audit_log_user_id ON user_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_created_at ON user_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_action ON user_audit_log(action);

-- Create index for blocked users
CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(blocked) WHERE blocked = true;
