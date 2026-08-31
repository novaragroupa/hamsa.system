-- ============================================================
-- Homsa — Secure employee authentication migration
-- Run this AFTER the original database/schema.sql.
-- ============================================================

alter table users add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;
alter table users add column if not exists status text not null default 'active';
alter table users add column if not exists created_by uuid references auth.users(id);
alter table users add column if not exists created_at timestamptz not null default now();

alter table employees add column if not exists user_id uuid unique references auth.users(id) on delete set null;
alter table employees add column if not exists username text unique;
alter table employees add column if not exists status text not null default 'active';

-- Remove plaintext passwords from the application-facing profile table.
alter table users drop column if exists password;

-- Keep profiles readable only by authenticated users. Fine-grained module RLS
-- should be tightened per department before production use.
alter table users enable row level security;
drop policy if exists "users_public_read" on users;
drop policy if exists "users_authenticated_read" on users;
create policy "users_authenticated_read" on users
  for select to authenticated using (true);

-- Employee profiles can be viewed by authenticated users; writes are performed
-- by the Edge Function using the service role after checking admin/HR.
alter table employees enable row level security;
drop policy if exists "employees_public_all" on employees;
drop policy if exists "employees_authenticated_read" on employees;
create policy "employees_authenticated_read" on employees
  for select to authenticated using (true);

-- Optional helper view for the dashboard.
create or replace view employee_accounts as
select
  e.id as employee_id,
  e.name,
  e.username,
  e.department,
  e.team,
  e.phone,
  e.status as employee_status,
  u.auth_user_id,
  u.role,
  u.status as account_status
from employees e
left join users u on u.auth_user_id = e.user_id;

-- IMPORTANT:
-- Existing demo users from the old schema do NOT automatically become
-- Supabase Auth accounts. Create the real admin/HR Auth users once, then link
-- their Auth UUIDs to users.auth_user_id.

-- Optional hardening: prevent anonymous access to the business tables.
do $$
declare t text;
begin
  foreach t in array array[
    'companies','visits','indoor_leads','indoor_data','reception_desk','reception_media',
    'callcenter_feedback','callcenter_payments','accommodation','accounting','teams','dashboards','widgets'
  ] loop
    execute format('drop policy if exists "allow all" on %I;', t);
    execute format('drop policy if exists "authenticated_all" on %I;', t);
    execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;
