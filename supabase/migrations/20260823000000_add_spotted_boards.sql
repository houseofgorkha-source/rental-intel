-- "Spotted To-Let Boards" — a homepage-only, map+photo section replicating
-- findghosla.com/tolet: a crowdsourced map of physical "TO LET" signboards,
-- explicitly disclaimed as unverified. Confirmed by the product owner as its
-- own thing, deliberately separate from `properties`/`reviews` — a spotted
-- board has no address, no name, nothing review-worthy attached to it, just
-- a photo, a pin, and a phone number.
--
-- This is the FIRST anonymous-write surface anywhere in this schema — every
-- other write in the app (property, review, message, broker registration)
-- requires `authenticated`. Two explicit product-owner decisions make that
-- true here: the phone number is public to everyone (not signed-in-only,
-- unlike every other contact detail in the app), and submission requires no
-- account. Both are confirmed, deliberate exceptions to how the rest of the
-- app works, not a precedent for anything else.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.


-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table public.spotted_boards (
  id uuid primary key default gen_random_uuid(),
  photo_storage_path text not null,
  latitude double precision not null,
  longitude double precision not null,
  phone text not null,
  city text not null,
  area text,
  -- A random id set in a first-party cookie on first visit (NOT the Supabase
  -- auth cookie -- there is no account here). The only thing this column is
  -- for is the rate-limit check in submit_spotted_board() below; it is never
  -- read back or displayed anywhere.
  anon_submitter_id uuid not null,
  created_at timestamptz not null default now()
);

create index spotted_boards_city_idx on public.spotted_boards(city);

alter table public.spotted_boards enable row level security;

-- Publicly readable, no restriction -- the phone number being public is a
-- confirmed, deliberate exception to how every other contact detail in this
-- app works (see file header).
create policy "Spotted boards are publicly readable"
on public.spotted_boards for select to anon, authenticated
using (true);

-- Deliberately NO insert policy for anon or authenticated. The table is
-- writable only through submit_spotted_board() below, which is
-- SECURITY DEFINER specifically so that is true -- unlike every other
-- INSERT in this schema (e.g. create_review, which is SECURITY INVOKER and
-- sits on top of an authenticated INSERT policy that also allows a direct
-- insert). Here there must be no direct insert path at all, since the only
-- gate an anonymous, account-less submission can have is the one inside
-- this function.
grant select on public.spotted_boards to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spotted-boards', 'spotted-boards', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage is a separate system from the tables above -- a file upload isn't
-- a SQL statement, so it can't be routed through submit_spotted_board() the
-- way the row itself is. This grant is real and unavoidable: anon can
-- upload directly into this bucket, full stop. The blast radius is smaller
-- than it sounds -- an uploaded file with no matching spotted_boards row
-- (e.g. because the rate limit below rejected the row insert) is just an
-- orphaned image nobody's page ever links to or renders; the app actively
-- deletes it in that case (see app/actions/spotted-boards.ts), and it costs
-- storage, not trust, since nothing false becomes visible to a renter.
create policy "Anyone can upload a spotted board photo"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'spotted-boards');


-- ---------------------------------------------------------------------------
-- 3. The one real gate: submit_spotted_board()
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, deliberately -- this function owns the table's only
-- write path (see section 1). Runs as its owner (the migration-applying
-- role), not the caller, which is exactly what lets it both (a) insert into
-- a table `anon` has no direct grant on, and (b) count recent submissions
-- for rate-limiting regardless of RLS. Neither is a privilege the caller
-- gains generally -- this function does exactly one thing and returns.
create or replace function public.submit_spotted_board(
  p_anon_submitter_id uuid,
  p_photo_storage_path text,
  p_latitude double precision,
  p_longitude double precision,
  p_phone text,
  p_city text,
  p_area text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
  v_id uuid;
begin
  if p_phone is null or btrim(p_phone) = '' then
    raise exception 'A phone number is required' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null then
    raise exception 'A location is required' using errcode = '22023';
  end if;

  -- Same reasoning as MAX_PROPERTIES_PER_DAY / MAX_REVIEWS_PER_DAY in
  -- app/actions/property.ts / app/actions/review.ts -- generous enough for
  -- a real contributor spotting several boards on one walk, tight enough to
  -- blunt a scripted flood. Enforced here, not just in the Server Action,
  -- specifically because this is the one write path in the app an attacker
  -- could otherwise reach directly with the public anon key (see file
  -- header) -- an app-layer-only check would be bypassable.
  select count(*) into v_recent_count
  from public.spotted_boards
  where anon_submitter_id = p_anon_submitter_id
    and created_at > now() - interval '24 hours';

  if v_recent_count >= 5 then
    raise exception 'You have added 5 spotted boards in the last 24 hours. Please try again tomorrow.'
      using errcode = '42501';
  end if;

  insert into public.spotted_boards (
    photo_storage_path, latitude, longitude, phone, city, area, anon_submitter_id
  )
  values (
    p_photo_storage_path, p_latitude, p_longitude, btrim(p_phone), p_city, p_area, p_anon_submitter_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_spotted_board(uuid, text, double precision, double precision, text, text, text) to anon, authenticated;
