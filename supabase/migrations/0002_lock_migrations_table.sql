-- Defense in depth: the migrations log is also closed to Supabase's public API.
alter table schema_migrations enable row level security;
