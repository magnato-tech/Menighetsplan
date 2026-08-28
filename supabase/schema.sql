-- Primærlager: ett JSON-snapshot (samme form som DatabaseState i appen).
-- Kjør i Supabase SQL Editor. Service role (Vercel /api/db) omgår RLS.

create table if not exists public.app_state (
  id int primary key default 1 check (id = 1),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_state_updated_at on public.app_state;
create trigger app_state_updated_at
  before update on public.app_state
  for each row
  execute function public.touch_app_state_updated_at();

alter table public.app_state enable row level security;

insert into public.app_state (id, payload)
values (1, '{}'::jsonb)
on conflict (id) do nothing;
