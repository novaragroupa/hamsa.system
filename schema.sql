-- ============================================================
--  Homsa System — Supabase (PostgreSQL) Schema
-- ============================================================
-- طريقة الاستخدام:
-- 1) روح على supabase.com وسجّل / سجّل دخول، واعمل مشروع جديد
--    (Project). خُد بالك من الباسورد بتاع قاعدة البيانات وخزنه.
-- 2) من القائمة الجانبية افتح "SQL Editor" → "New query".
-- 3) الصق الكود ده كامل واضغط "Run".
-- 4) من "Project Settings > API" خُد:
--      - Project URL
--      - anon public key
--    وحطهم في index.html جوه المتغيرين SUPABASE_URL و SUPABASE_ANON_KEY.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- جدول المستخدمين وتسجيل الدخول ----------
create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  username text unique not null,
  password text not null,
  role text not null,
  name text not null
);

insert into users (username, password, role, name) values
  ('admin', 'admin123', 'admin', 'مدير النظام'),
  ('hr', 'hr123', 'hr', 'موظف HR'),
  ('pr_out', 'pr123', 'pr_out', 'مندوب علاقات عامة (أوت دور)'),
  ('pr_in', 'prin123', 'pr_in', 'موظف علاقات عامة (إن دور)'),
  ('reception', 'rec123', 'reception', 'موظف استقبال'),
  ('accounting', 'acc123', 'accounting', 'موظف حسابات'),
  ('callcenter', 'cc123', 'callcenter', 'موظف كول سنتر'),
  ('accommodation', 'acco123', 'accommodation', 'موظف تسكين'),
  ('system', 'sys123', 'system', 'موظف حجوزات (سستيم)')
on conflict (username) do nothing;

-- ---------- الموظفون ----------
create table if not exists employees (
  id text primary key default gen_random_uuid()::text,
  photo text,
  name text,
  "specialNumber" text,
  "companyNumber" text,
  department text,
  phone text,
  address text,
  "hireDate" date,
  salary numeric
);

-- ---------- الشركات (أوت دور) ----------
create table if not exists companies (
  id text primary key default gen_random_uuid()::text,
  name text,
  area text,
  "contactName" text,
  "contactPhone" text,
  "responsiblePerson" text,
  details text
);

-- ---------- تقارير الزيارات ----------
create table if not exists visits (
  id text primary key default gen_random_uuid()::text,
  "companyName" text,
  "visitedBy" text,
  date date,
  status text,
  notes text
);

-- ---------- المهتمون والمندوبين (إن دور) ----------
create table if not exists indoor_leads (
  id text primary key default gen_random_uuid()::text,
  name text,
  phone text,
  type text,
  status text,
  "sourceType" text,
  "responsiblePerson" text,
  "managerRep" text,
  notes text
);

-- ---------- الداتا والأرقام (إن دور) ----------
create table if not exists indoor_data (
  id text primary key default gen_random_uuid()::text,
  name text,
  phone text,
  source text,
  "responsiblePerson" text,
  notes text
);

-- ---------- الريسبشن ----------
create table if not exists reception_desk (
  id text primary key default gen_random_uuid()::text,
  "visitorName" text,
  phone text,
  purpose text,
  time text,
  notes text
);

-- ---------- استقبال ميديا ----------
create table if not exists reception_media (
  id text primary key default gen_random_uuid()::text,
  name text,
  phone text,
  platform text,
  inquiry text
);

-- ---------- فيدباك عملاء العمرة (كول سنتر) ----------
create table if not exists callcenter_feedback (
  id text primary key default gen_random_uuid()::text,
  "clientName" text,
  phone text,
  "tripDate" date,
  rating text,
  feedback text
);

-- ---------- متابعة المتأخرين في السداد (كول سنتر) ----------
create table if not exists callcenter_payments (
  id text primary key default gen_random_uuid()::text,
  "clientName" text,
  phone text,
  "amountDue" numeric,
  "lastContactDate" date,
  notes text
);

-- ---------- التسكين ----------
create table if not exists accommodation (
  id text primary key default gen_random_uuid()::text,
  "clientName" text,
  "passportNumber" text,
  trip text,
  "daysRemaining" numeric,
  "roomOccupants" numeric,
  hotel text,
  "flightStatus" text
);

-- ---------- كشف الحساب / الحسابات ----------
create table if not exists accounting (
  id text primary key default gen_random_uuid()::text,
  "clientName" text,
  date date,
  description text,
  "packageType" text,
  debit numeric default 0,
  credit numeric default 0
);

-- ---------- الفرق (Teams) — كل قسم بينقسم لفرق، ولكل فريق قائد ----------
create table if not exists teams (
  id text primary key default gen_random_uuid()::text,
  name text,
  department text,
  leader text,
  notes text
);

-- ربط كل موظف بالفريق بتاعه
alter table employees add column if not exists team text;

-- ---------- لوحات تحليل البيانات (Analytics) — لوحة لكل قسم/مصدر بيانات ----------
create table if not exists dashboards (
  id text primary key default gen_random_uuid()::text,
  name text,
  "sourceModule" text,
  department text,
  "createdBy" text
);

-- ---------- عناصر التحليل داخل كل لوحة (رسم دائري / أعمدة / جدول / رقم) ----------
create table if not exists widgets (
  id text primary key default gen_random_uuid()::text,
  "dashboardId" text references dashboards(id) on delete cascade,
  title text,
  "chartType" text,
  "groupBy" text,
  metric text default 'count',
  "metricField" text
);

-- ============================================================
--  الصلاحيات (RLS) — إعداد سريع للتجربة فقط
-- ============================================================
-- ⚠️ تنبيه أمان مهم:
-- السطور دي بتفتح كل الجداول للقراءة والكتابة لأي حد معاه الـ
-- anon key (وهو مكشوف أصلًا جوه index.html لأنه بيشتغل من المتصفح
-- مباشرة). ده مقبول لعمل نموذج أولي (Prototype) سريع بس، لكن قبل
-- استخدام النظام فعليًا مع بيانات حقيقية وموظفين لازم:
--   1) تفعيل Supabase Auth بدل تسجيل الدخول اليدوي بجدول users.
--   2) تضييق سياسات RLS بحيث كل دور يشوف/يعدّل الجداول
--      الخاصة بيه بس (بدل "allow all" العامة دي).
--   3) تشفير كلمة المرور بدل تخزينها كنص عادي.
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'users','employees','companies','visits','indoor_leads','indoor_data',
    'reception_desk','reception_media','callcenter_feedback',
    'callcenter_payments','accommodation','accounting',
    'teams','dashboards','widgets'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'drop policy if exists "allow all" on %I;
       create policy "allow all" on %I for all using (true) with check (true);',
      t, t
    );
  end loop;
end $$;
