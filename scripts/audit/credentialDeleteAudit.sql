-- Delete-audit instrumentation for Vortex credential/identity tables.
--
-- Postgres triggers are not expressible in the Drizzle schema, so this is
-- applied out-of-band (not a Drizzle migration) and kept here, idempotent, so
-- it is reproducible:
--   kubectl --context admin@fractal -n fractal-vortex exec -i vortex-db-1 -c postgres -- \
--     psql -U postgres -d vortex < scripts/audit/credentialDeleteAudit.sql
--
-- It records every row DELETE on `user` (identity mirror) and `oauth_token`
-- (integration credentials) so a credential/account removal can never go
-- unnoticed. It logs identifying fields and session context, never the secret
-- token values themselves.

CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.credential_delete_log (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name       text        NOT NULL,
  row_id           uuid,
  identity         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  had_secret       boolean,
  db_user          text        NOT NULL,
  application_name text,
  client_addr      inet,
  query            text,
  deleted_at       timestamptz NOT NULL DEFAULT now()
);

-- Generic trigger function: snapshots the deleted row as jsonb (so a single
-- function serves any table) and extracts only non-secret identifying fields.
CREATE OR REPLACE FUNCTION audit.log_credential_delete()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
DECLARE
  rec jsonb := to_jsonb(OLD);
BEGIN
  INSERT INTO audit.credential_delete_log (
    table_name, row_id, identity, had_secret,
    db_user, application_name, client_addr, query
  )
  VALUES (
    TG_TABLE_NAME,
    NULLIF(rec->>'id', '')::uuid,
    CASE TG_TABLE_NAME
      WHEN 'oauth_token' THEN jsonb_build_object(
        'integration_id', rec->'integration_id',
        'organization_id', rec->'organization_id',
        'provider', rec->'provider')
      WHEN 'user' THEN jsonb_build_object(
        'identity_provider_id', rec->'identity_provider_id',
        'email', rec->'email')
      ELSE '{}'::jsonb
    END,
    CASE TG_TABLE_NAME
      WHEN 'oauth_token'
        THEN ((rec->>'access_token') IS NOT NULL OR (rec->>'refresh_token') IS NOT NULL)
      ELSE NULL
    END,
    current_user,
    current_setting('application_name', true),
    inet_client_addr(),
    current_query()
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_credential_delete_audit ON public."user";
CREATE TRIGGER trg_credential_delete_audit
  BEFORE DELETE ON public."user"
  FOR EACH ROW EXECUTE FUNCTION audit.log_credential_delete();

DROP TRIGGER IF EXISTS trg_credential_delete_audit ON public.oauth_token;
CREATE TRIGGER trg_credential_delete_audit
  BEFORE DELETE ON public.oauth_token
  FOR EACH ROW EXECUTE FUNCTION audit.log_credential_delete();
