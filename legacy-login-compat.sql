-- ============================================================
-- Homsa — Legacy login compatibility
-- شغّل هذا الملف فقط إذا كانت قاعدة البيانات القديمة موجودة لديك
-- وتريد أن تعمل حسابات schema.sql الافتراضية مؤقتًا بدون إنشاء
-- Supabase Auth users.
-- ============================================================

-- هذا الحل لا يعيد كلمات المرور للمتصفح؛ التحقق يتم داخل PostgreSQL.
-- لا تستخدمه كنظام دخول نهائي للإنتاج. بعد الدخول، انتقل إلى Supabase Auth
-- باستخدام auth-migration.sql وحسابات Auth الحقيقية.

alter table public.users add column if not exists password text;
alter table public.users add column if not exists status text not null default 'active';

-- حسابات البداية المطابقة لـ schema.sql.
insert into public.users (username, password, role, name, status) values
  ('admin', 'admin123', 'admin', 'مدير النظام', 'active'),
  ('hr', 'hr123', 'hr', 'موظف HR', 'active'),
  ('pr_out', 'pr123', 'pr_out', 'مندوب علاقات عامة (أوت دور)', 'active'),
  ('pr_in', 'prin123', 'pr_in', 'موظف علاقات عامة (إن دور)', 'active'),
  ('reception', 'rec123', 'reception', 'موظف استقبال', 'active'),
  ('accounting', 'acc123', 'accounting', 'موظف حسابات', 'active'),
  ('callcenter', 'cc123', 'callcenter', 'موظف كول سنتر', 'active'),
  ('accommodation', 'acco123', 'accommodation', 'موظف تسكين', 'active'),
  ('system', 'sys123', 'system', 'موظف حجوزات (سستيم)', 'active')
on conflict (username) do update
set password=excluded.password, status='active';

create or replace function public.legacy_login(p_username text, p_password text)
returns table(id text, username text, role text, name text, status text, auth_user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select u.id, u.username, u.role, u.name, u.status, u.auth_user_id
  from public.users u
  where lower(u.username)=lower(trim(p_username))
    and u.password=p_password
    and coalesce(u.status,'active')='active'
  limit 1;
end;
$$;

revoke all on function public.legacy_login(text,text) from public;
grant execute on function public.legacy_login(text,text) to anon, authenticated;
