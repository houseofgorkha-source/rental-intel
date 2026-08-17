-- A broker directory, populated only by brokers registering themselves --
-- never scraped, never seeded from a third-party site. See CLAUDE.md for the
-- context: RentalIntel deliberately had no broker role until now (this
-- migration is the point that changes, on the product owner's explicit
-- decision -- lib/property-attributes.ts's POSTED_BY_OPTIONS comment
-- documenting "no broker option" describes the property-submission model,
-- which is untouched; a broker is a new, separate kind of entity, not a
-- fourth `submitted_as` value).
--
-- Same self-declared, unverified, no-moderation-gate philosophy the rest of
-- this product already uses for properties (see 20260813000000): a broker
-- publishes immediately, is free to mark their own listing inactive, and
-- nothing here claims to have verified anyone's credentials.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.


-- ---------------------------------------------------------------------------
-- 1. public.brokers
-- ---------------------------------------------------------------------------
create table public.brokers (
  id uuid primary key default gen_random_uuid(),
  -- unique: one broker profile per account. A person registers themselves
  -- once, the same way a profile row is one-per-user -- not a list of
  -- listings the way `properties` is, where the same person can genuinely
  -- have added several distinct properties.
  created_by uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  agency_name text,
  city text not null,
  -- Free text, deliberately not an enum -- mirrors properties.area, which is
  -- also unvalidated free text. A curated locality list (lib/cities.ts)
  -- already exists for suggestions/autocomplete; it was never meant to be a
  -- hard constraint on what a submitter can type.
  areas text[] not null default '{}',
  bio text,
  contact_method public.property_contact_method not null default 'none',
  -- The commercial on/off switch, same role properties.is_available plays --
  -- not a moderation state. A broker can take their own listing down at any
  -- time without it being a status change an admin has to approve.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brokers_city_idx on public.brokers(city);
create index brokers_created_by_idx on public.brokers(created_by);

create trigger brokers_set_updated_at
before update on public.brokers
for each row execute function public.set_updated_at();

alter table public.brokers enable row level security;

-- The whole directory is public -- browsing it requires no account, same as
-- browsing properties.
create policy "Active brokers are publicly readable"
on public.brokers for select to anon, authenticated
using (is_active = true);

-- A broker can always see their own listing, active or not, so they can
-- reactivate it or check what's published.
create policy "Brokers can read their own listing"
on public.brokers for select to authenticated
using (created_by = auth.uid());

create policy "Authenticated users can register as a broker"
on public.brokers for insert to authenticated
with check (created_by = auth.uid());

create policy "Brokers can update their own listing"
on public.brokers for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "Brokers can remove their own listing"
on public.brokers for delete to authenticated
using (created_by = auth.uid());

grant select, insert, update, delete on public.brokers to authenticated;
grant select on public.brokers to anon;
grant select, insert, update, delete on public.brokers to service_role;


-- ---------------------------------------------------------------------------
-- 2. public.broker_contacts
-- ---------------------------------------------------------------------------
-- Split into its own table for the same reason property_contacts is split
-- from properties (20260810000000): so a broad `select *` on the parent
-- table can never leak more than the policy on THIS table allows -- even
-- though today's policy is deliberately public (see below), keeping the
-- split means a future column added to `brokers` is never accidentally
-- exposed as a side effect of this table's openness.
--
-- Deliberately public read (unlike property_contacts, which requires
-- sign-in): a broker directory's entire value is being reachable, and that
-- was an explicit product decision, not an oversight.
create table public.broker_contacts (
  broker_id uuid primary key references public.brokers(id) on delete cascade,
  phone text check (phone is null or char_length(phone) between 6 and 20),
  email text check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger broker_contacts_set_updated_at
before update on public.broker_contacts
for each row execute function public.set_updated_at();

alter table public.broker_contacts enable row level security;

create policy "Broker contact details are publicly readable"
on public.broker_contacts for select to anon, authenticated
using (true);

create policy "Brokers can add their own contact details"
on public.broker_contacts for insert to authenticated
with check (
  exists (
    select 1 from public.brokers
    where brokers.id = broker_contacts.broker_id
      and brokers.created_by = auth.uid()
  )
);

create policy "Brokers can update their own contact details"
on public.broker_contacts for update to authenticated
using (
  exists (
    select 1 from public.brokers
    where brokers.id = broker_contacts.broker_id
      and brokers.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.brokers
    where brokers.id = broker_contacts.broker_id
      and brokers.created_by = auth.uid()
  )
);

create policy "Brokers can remove their own contact details"
on public.broker_contacts for delete to authenticated
using (
  exists (
    select 1 from public.brokers
    where brokers.id = broker_contacts.broker_id
      and brokers.created_by = auth.uid()
  )
);

grant select, insert, update, delete on public.broker_contacts to authenticated;
grant select on public.broker_contacts to anon;
grant select, insert, update, delete on public.broker_contacts to service_role;
