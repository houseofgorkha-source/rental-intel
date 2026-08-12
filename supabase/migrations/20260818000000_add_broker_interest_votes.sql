-- A single yes/no opinion poll: "should RentalIntel include a broker
-- listings section?" Not a broker feature — a demand signal, so the product
-- owner can decide whether one is ever worth building. See
-- lib/property-attributes.ts's POSTED_BY_OPTIONS comment: there is
-- deliberately no broker role anywhere else in the schema, and this table
-- does not add one.
--
-- No identity is captured. A vote is one boolean and a timestamp, nothing
-- that could be traced back to a person — this is a public poll, not account
-- data, so both reading and writing are open to anon as well as
-- authenticated. Per-browser "have I already voted" is handled client-side
-- (localStorage), a soft courtesy rather than a security boundary; nothing
-- about the poll's integrity depends on it.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.

create table public.broker_interest_votes (
  id uuid primary key default gen_random_uuid(),
  wants_brokers boolean not null,
  created_at timestamptz not null default now()
);

alter table public.broker_interest_votes enable row level security;

create policy "Anyone can record a broker-interest vote"
on public.broker_interest_votes for insert to anon, authenticated
with check (true);

create policy "Anyone can read broker-interest vote counts"
on public.broker_interest_votes for select to anon, authenticated
using (true);

grant select, insert on public.broker_interest_votes to anon, authenticated;
