-- Monchys Store: initial schema (replaces the JSON files in server/data/)
-- Run with: npm run db:migrate
--
-- Security: the server connects directly to Postgres (DATABASE_URL) and does its own auth.
-- Row Level Security is enabled on every table WITHOUT policies, so Supabase's public REST API
-- (anon / authenticated keys) cannot read or write anything. The postgres role used by the
-- server bypasses RLS.

create extension if not exists citext;

-- ---------- Catalog ----------
create table if not exists products (
  id          text primary key check (id ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),
  name        text not null,
  price       numeric(10, 2) not null check (price >= 0),
  period      text not null default 'once' check (period in ('once', 'month')),
  category    text not null,
  icon        text not null,
  "desc"      text not null,
  details     text not null default '',
  specs       jsonb not null default '{}'::jsonb,
  tool_url    text not null default '',
  demo_url    text not null default '',
  includes    text[] not null default '{}',   -- plans: ids of the products they unlock
  published   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Customers and subscriptions ----------
create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          citext not null unique,
  password_hash  text not null,
  created_at     timestamptz not null default now()
);

create table if not exists subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  product_id  text not null references products (id) on update cascade,
  period      text not null check (period in ('once', 'month')),
  price       numeric(10, 2) not null check (price >= 0),
  status      text not null check (status in ('active', 'cancelled', 'expired')),
  started_at  timestamptz not null default now(),
  renews_at   timestamptz,
  ends_at     timestamptz,
  demo        boolean not null default true   -- true while no payment provider is connected
);
create index if not exists subscriptions_user_idx on subscriptions (user_id);
-- At most one live (active or cancelled-but-paid) subscription per user and product
create unique index if not exists subscriptions_live_uidx on subscriptions (user_id, product_id) where status <> 'expired';

-- ---------- Booking assistant ----------
create table if not exists businesses (
  id            text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name          text not null,
  description   text not null default '',
  timezone      text not null,
  slot_minutes  integer not null check (slot_minutes in (10, 15, 20, 30, 45, 60)),
  hours         jsonb not null,                -- 7 arrays (0 = Sunday) of [open, close] ranges
  faq           text not null default '',
  owner_email   citext,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists business_services (
  business_id  text not null references businesses (id) on delete cascade,
  id           text not null,
  name         text not null,
  minutes      integer not null check (minutes between 5 and 480),
  price        numeric(10, 2) not null check (price >= 0),
  sort_order   integer not null default 0,
  primary key (business_id, id)
);

create table if not exists bookings (
  id            text primary key,
  business_id   text not null references businesses (id) on delete cascade,
  service_id    text not null,
  service_name  text not null,
  minutes       integer not null,
  date          date not null,
  time          time not null,
  name          text not null,
  phone         text not null,
  notes         text not null default '',
  status        text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  source        text not null check (source in ('form', 'chat')),
  created_at    timestamptz not null default now()
);
create index if not exists bookings_business_date_idx on bookings (business_id, date);

-- ---------- Monchys Ahorro ----------
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  type        text not null check (type in ('expense', 'income')),
  amount      numeric(14, 2) not null check (amount > 0),
  category    text not null,
  date        date not null,
  note        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists expenses_user_date_idx on expenses (user_id, date);

create table if not exists savings_settings (
  user_id  uuid primary key references users (id) on delete cascade,
  budgets  jsonb not null default '{}'::jsonb,  -- { category: monthly amount }
  goal     numeric(14, 2) not null default 0
);

-- ---------- Diario emocional ----------
create table if not exists journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  date        date not null,
  mood        smallint not null check (mood between 1 and 5),
  emotions    text[] not null default '{}',
  text        text not null default '',
  prompt      text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists journal_user_date_idx on journal_entries (user_id, date);

-- ---------- Generador de CV ----------
create table if not exists cvs (
  user_id     uuid primary key references users (id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ---------- Resumidor de PDFs ----------
create table if not exists pdf_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  name          text not null,
  pages         integer not null,
  summary       text not null,
  summary_kind  text not null check (summary_kind in ('ai', 'extractive')),
  key_terms     text[] not null default '{}',
  file_path     text not null,                 -- where the PDF is stored (disk or Supabase Storage)
  created_at    timestamptz not null default now()
);
create index if not exists pdf_documents_user_idx on pdf_documents (user_id, created_at desc);

create table if not exists pdf_messages (
  id           bigint generated always as identity primary key,
  document_id  uuid not null references pdf_documents (id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  created_at   timestamptz not null default now()
);
create index if not exists pdf_messages_doc_idx on pdf_messages (document_id, id);

-- ---------- Transcripción ----------
create table if not exists transcriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users (id) on delete cascade,
  name              text not null,
  language          text not null,
  duration_seconds  integer not null,
  text              text not null,
  segments          jsonb not null default '[]'::jsonb,
  summary           text,
  created_at        timestamptz not null default now()
);
create index if not exists transcriptions_user_idx on transcriptions (user_id, created_at desc);

-- ---------- Usage limits and AI spend ----------
create table if not exists usage_counters (
  user_id  uuid not null references users (id) on delete cascade,
  month    char(7) not null,                   -- 'YYYY-MM'
  metric   text not null,                      -- transcriptionMinutes, backgroundImages…
  amount   numeric(14, 4) not null default 0,
  primary key (user_id, month, metric)
);

create table if not exists ai_usage (
  month          char(7) not null,
  feature        text not null,
  calls          integer not null default 0,
  input_tokens   bigint not null default 0,
  output_tokens  bigint not null default 0,
  cost           numeric(12, 6) not null default 0,
  primary key (month, feature)
);

create table if not exists ai_budgets (
  month    char(7) not null,
  subject  text not null,                      -- 'user:<uuid>' or 'biz:<id>'
  cost     numeric(12, 6) not null default 0,
  primary key (month, subject)
);

-- ---------- Lock every table from Supabase's public API ----------
do $$
declare t text;
begin
  foreach t in array array[
    'products', 'users', 'subscriptions', 'businesses', 'business_services', 'bookings',
    'expenses', 'savings_settings', 'journal_entries', 'cvs', 'pdf_documents', 'pdf_messages',
    'transcriptions', 'usage_counters', 'ai_usage', 'ai_budgets'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
