-- Property attributes the discovery filters actually need, plus the
-- contributor contact preference.
--
-- Why this exists: the Filters panel has been offering Bedrooms, Property
-- type, Furnishing and Minimum area since it was built, but `properties` held
-- none of those facts. The panel therefore let people select a value that
-- could not possibly change the results -- the filter UI was describing a
-- product that did not exist below it. This migration adds the columns so the
-- filters can be wired to real data instead of being reconstructed from
-- information the schema never collected.
--
-- Deliberately NOT added: amenities. It is a many-valued attribute needing its
-- own table, no requirement asks for it, and the panel already discloses it as
-- coming soon. Adding a column per amenity, or an untyped text[] nobody
-- validates, would be exactly the speculative infrastructure this project
-- avoids.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.


-- ---------------------------------------------------------------------------
-- 1. Filterable attributes
-- ---------------------------------------------------------------------------
-- Enums rather than free text, for one specific reason: the same value has to
-- mean the same thing in the registration form, the stored row, the filter
-- chip, the filter query and the property page. Free text would let '1 RK',
-- '1RK' and 'RK 1' all exist and silently split one filter into three. The
-- enum makes every variant except the canonical one un-writable, so the
-- consistency is enforced by Postgres and not by five call sites agreeing.
--
-- The labels ARE the canonical values, spaces and all, so nothing has to map
-- between a stored code and a displayed string. lib/property-attributes.ts
-- mirrors these lists exactly and is the single source for the UI.
create type public.property_configuration as enum (
  '1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK'
);

create type public.property_type as enum (
  'Apartment', 'Independent house', 'Villa', 'PG / Co-living', 'Studio'
);

create type public.property_furnishing as enum (
  'Unfurnished', 'Semi-furnished', 'Fully furnished'
);

-- All nullable: every existing row genuinely does not have this information,
-- and a default would assert a fact about somebody else's property that nobody
-- ever told us. A NULL is excluded from a positive filter and shown as
-- "Not provided", never as a value.
alter table public.properties
  add column configuration public.property_configuration,
  add column property_type public.property_type,
  add column furnishing public.property_furnishing,
  add column carpet_area_sqft integer
    check (carpet_area_sqft is null or (carpet_area_sqft > 0 and carpet_area_sqft <= 100000));

-- "Posted by" deliberately gets no column: `submitted_as` (20260808000000)
-- already records exactly that, and a second provenance field would be a
-- second answer to the same question.


-- ---------------------------------------------------------------------------
-- 2. Contact preference
-- ---------------------------------------------------------------------------
-- How the contributor is willing to be contacted. This column is safe to be
-- publicly readable because it holds no contact detail -- only the channel.
-- 'none' is the default on purpose: registering a property is not consent to
-- be contacted, so exposure has to be opted into.
create type public.property_contact_method as enum ('phone', 'email', 'message', 'none');

alter table public.properties
  add column contact_method public.property_contact_method not null default 'none';

-- The actual phone number and email address live in their own table, NOT on
-- `properties`.
--
-- This is the whole point of the split: `properties` has the policy "Published
-- properties are publicly readable", so any column on it is served to anon in
-- every discovery query. A phone number on that row would be scraped out of
-- the public listing payload the moment a property was published, whether or
-- not the UI rendered it. Keeping the details in a separate table means the
-- exposure decision is a policy on that table, and `select *` on properties
-- can never leak them.
create table public.property_contacts (
  property_id uuid primary key references public.properties(id) on delete cascade,
  phone text check (phone is null or char_length(phone) between 6 and 20),
  email text check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger property_contacts_set_updated_at
before update on public.property_contacts
for each row execute function public.set_updated_at();

alter table public.property_contacts enable row level security;

-- Signed in, and only for the channel the contributor actually chose. A
-- contributor who picked 'email' has not agreed to hand out their phone
-- number, so the row is unreadable unless contact_method matches something
-- this table can answer. anon gets nothing at all: that is what makes
-- "contact requires an account" a database rule rather than a UI convention.
create policy "Signed-in users can read contact details the contributor chose to share"
on public.property_contacts for select to authenticated
using (
  exists (
    select 1 from public.properties
    where properties.id = property_contacts.property_id
      and properties.status = 'published'
      and properties.contact_method in ('phone', 'email')
  )
);

-- The contributor always sees their own, whatever the channel and whatever
-- the moderation status -- otherwise they could not check or correct what
-- they had entered.
create policy "Contributors can read their own contact details"
on public.property_contacts for select to authenticated
using (
  exists (
    select 1 from public.properties
    where properties.id = property_contacts.property_id
      and properties.created_by = auth.uid()
  )
);

create policy "Contributors can add their own contact details"
on public.property_contacts for insert to authenticated
with check (
  exists (
    select 1 from public.properties
    where properties.id = property_contacts.property_id
      and properties.created_by = auth.uid()
  )
);

create policy "Contributors can update their own contact details"
on public.property_contacts for update to authenticated
using (
  exists (
    select 1 from public.properties
    where properties.id = property_contacts.property_id
      and properties.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.properties
    where properties.id = property_contacts.property_id
      and properties.created_by = auth.uid()
  )
);

create policy "Contributors can remove their own contact details"
on public.property_contacts for delete to authenticated
using (
  exists (
    select 1 from public.properties
    where properties.id = property_contacts.property_id
      and properties.created_by = auth.uid()
  )
);


-- ---------------------------------------------------------------------------
-- 3. "Message here" -- the smallest thing that is actually a message
-- ---------------------------------------------------------------------------
-- This is not a messaging platform and must not grow into one. There are no
-- threads, no read receipts, no attachments, no replies-to-replies, no
-- notifications, no presence. One row = one person asking one contributor
-- about one property. That is the entire feature, and it is the minimum that
-- makes "Message here" mean something rather than silently discarding what
-- somebody typed.
--
-- `recipient_id` is stored rather than derived from properties.created_by at
-- read time, so a message stays attached to the person it was actually sent
-- to even if the property is later removed or its creator is nulled out by the
-- `on delete set null` on properties.created_by.
create table public.property_messages (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  created_at timestamptz not null default now(),
  -- A message to yourself is never a real enquiry; it is a bug or an abuse of
  -- the endpoint. Rejected in the schema so no caller has to remember.
  constraint property_messages_distinct_parties check (sender_id <> recipient_id)
);

create index property_messages_recipient_idx
  on public.property_messages(recipient_id, created_at desc);
create index property_messages_sender_idx
  on public.property_messages(sender_id, created_at desc);

alter table public.property_messages enable row level security;

-- Both sides of the conversation can read it, and nobody else -- not other
-- signed-in users, not anon.
create policy "Participants can read their own messages"
on public.property_messages for select to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

-- The three conditions are all load-bearing:
--   * sender_id = auth.uid()   -- you cannot send as somebody else
--   * recipient is the property's creator, checked here rather than trusted
--     from the client, so the recipient cannot be redirected to an arbitrary
--     user id and this table cannot be used to message strangers
--   * contact_method = 'message' -- a contributor who chose 'none', 'phone' or
--     'email' did not agree to receive messages here, and that choice is
--     enforced by the database rather than by hiding a button
create policy "Signed-in users can message a contributor who opted in"
on public.property_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.properties
    where properties.id = property_messages.property_id
      and properties.status = 'published'
      and properties.contact_method = 'message'
      and properties.created_by = property_messages.recipient_id
  )
);

-- No UPDATE and no DELETE policy, deliberately. A sent message is a record of
-- what was said; neither party gets to rewrite or erase it through the API.


-- ---------------------------------------------------------------------------
-- 4. Table privileges
-- ---------------------------------------------------------------------------
-- Both tables are created after 20260805000003's `grant ... on all tables`, so
-- they inherit nothing from it and these are their complete privilege sets.
-- Postgres checks table privileges BEFORE RLS, so without these every policy
-- above would be unreachable.
grant select, insert, update, delete on public.property_contacts to authenticated;
grant select, insert on public.property_messages to authenticated;
grant select, insert, update, delete on public.property_contacts to service_role;
grant select, insert, update, delete on public.property_messages to service_role;
