-- Minimal stand-in for Supabase: auth schema, auth.uid() from a session setting, roles.
create schema auth; create schema extensions;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role authenticated nologin;
grant usage on schema public, auth, extensions to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
