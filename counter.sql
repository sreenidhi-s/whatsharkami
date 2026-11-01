-- Run once in the Supabase SQL editor. The initial value matches the Figma placeholder.
create table if not exists public.shark_counter (
  singleton boolean primary key default true check (singleton),
  total bigint not null default 12847
);
insert into public.shark_counter (singleton, total)
values (true, 12847) on conflict (singleton) do nothing;

create table if not exists public.shark_quiz_sessions (
  session_id uuid primary key,
  completed_at timestamptz not null default now()
);

alter table public.shark_counter enable row level security;
alter table public.shark_quiz_sessions enable row level security;
revoke all on public.shark_counter from anon, authenticated;
revoke all on public.shark_quiz_sessions from anon, authenticated;

create or replace function public.get_count()
returns bigint
language sql stable security definer
set search_path = ''
as $$ select total from public.shark_counter where singleton = true; $$;

create or replace function public.complete_quiz(p_session_id uuid)
returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  inserted_id uuid;
  current_total bigint;
begin
  insert into public.shark_quiz_sessions (session_id)
  values (p_session_id)
  on conflict (session_id) do nothing
  returning session_id into inserted_id;

  if inserted_id is not null then
    update public.shark_counter set total = total + 1 where singleton = true;
  end if;
  select total into current_total from public.shark_counter where singleton = true;
  return current_total;
end;
$$;

revoke all on function public.get_count() from public;
revoke all on function public.complete_quiz(uuid) from public;
grant execute on function public.get_count() to anon, authenticated;
grant execute on function public.complete_quiz(uuid) to anon, authenticated;

-- Record each download/share button activation without storing visitor details.
-- The client-generated event UUID makes retries idempotent.
create table if not exists public.shark_card_actions (
  event_id uuid primary key,
  action text not null check (action in ('download', 'share')),
  recorded_at timestamptz not null default now()
);

alter table public.shark_card_actions enable row level security;
revoke all on public.shark_card_actions from anon, authenticated;

create or replace function public.record_card_action(p_event_id uuid, p_action text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_action not in ('download', 'share') then
    raise exception 'Unsupported Shark ID action' using errcode = '22023';
  end if;

  insert into public.shark_card_actions (event_id, action)
  values (p_event_id, p_action)
  on conflict (event_id) do nothing;
  return true;
end;
$$;

create or replace function public.get_card_action_counts()
returns table(downloads bigint, shares bigint)
language sql stable security definer
set search_path = ''
as $$
  select
    count(*) filter (where action = 'download'),
    count(*) filter (where action = 'share')
  from public.shark_card_actions;
$$;

revoke all on function public.record_card_action(uuid, text) from public;
revoke all on function public.get_card_action_counts() from public;
grant execute on function public.record_card_action(uuid, text) to anon, authenticated;
grant execute on function public.get_card_action_counts() to anon, authenticated;
