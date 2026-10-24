-- Up Migration

-- An invite is a one-time token emailed to a new person so they can set their
-- own password. Only the hash is kept, exactly as for a password: whoever holds
-- the raw token can use it once, and a leaked database cannot be used to mint
-- an invite link.
--
-- The table already existed for this purpose but had no owner, no reason and no
-- lookup path, so it gains all three.

ALTER TABLE cerberus_admin_tokens
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT cerberus_admin_tokens_user_fkey
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  ADD COLUMN purpose varchar(20) NOT NULL DEFAULT 'INVITE',
  ADD CONSTRAINT cerberus_admin_tokens_purpose_check
    CHECK (purpose IN ('INVITE', 'PASSWORD_RESET'));

-- Every lookup is by the hash of the token the person presents.
CREATE UNIQUE INDEX cerberus_admin_tokens_hash_key ON cerberus_admin_tokens (token_hash);

-- Finding a person's outstanding invite, to replace it when one is re-sent.
CREATE INDEX cerberus_admin_tokens_user_idx ON cerberus_admin_tokens (user_id, purpose);

-- Down Migration

DROP INDEX cerberus_admin_tokens_user_idx;
DROP INDEX cerberus_admin_tokens_hash_key;
ALTER TABLE cerberus_admin_tokens
  DROP CONSTRAINT cerberus_admin_tokens_purpose_check,
  DROP COLUMN purpose,
  DROP CONSTRAINT cerberus_admin_tokens_user_fkey,
  ALTER COLUMN user_id DROP NOT NULL;
