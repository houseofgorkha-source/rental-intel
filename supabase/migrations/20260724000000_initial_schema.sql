-- RentalIntel MVP backend foundation.
-- Apply through the Supabase CLI migration workflow or the Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.property_status as enum ('pending', 'published', 'rejected');
create type public.recommendation as enum ('yes', 'maybe', 'no');
create type public.review_verification_status as enum (
  'unverified',
  'pending',
  'verified',
  'rejected'
);
create type public.verification_request_status as enum (
  'pending',
  'verified',
  'rejected'
);
create type public.verification_document_type as enum (
  'rental_agreement',
  'rent_receipt',
  'electricity_bill',
  'other_proof_of_stay'
);
create type public.review_issue_type as enum (
  'deposit_delay',
  'deposit_deduction',
  'hidden_charges',
  'water_issues',
  'power_issues',
  'noise',
  'parking',
  'safety',
  'owner_behavior',
  'maintenance',
  'broker_issues',
  'pet_restrictions',
  'other'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'RentalIntel member'
    )
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address_line_1 text not null,
  address_line_2 text,
  area text not null,
  city text not null,
  state text not null,
  postal_code text,
  maps_url text,
  notes text,
  asking_rent integer check (asking_rent is null or asking_rent >= 0),
  currency char(3) not null default 'INR',
  status public.property_status not null default 'pending',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_status_idx on public.properties(status);
create index properties_status_city_name_idx
  on public.properties(status, city, name);

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (property_id, storage_path)
);

create index property_images_property_sort_idx
  on public.property_images(property_id, sort_order);

create table public.review_categories (
  id smallint generated always as identity primary key,
  slug text not null unique,
  label text not null,
  sort_order smallint not null unique check (sort_order >= 0)
);

insert into public.review_categories (slug, label, sort_order)
values
  ('owner_behavior', 'Owner Behaviour', 1),
  ('maintenance', 'Maintenance', 2),
  ('water_supply', 'Water Supply', 3),
  ('security', 'Security', 4),
  ('cleanliness', 'Cleanliness', 5);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  is_anonymous boolean not null default false,
  title text not null check (char_length(trim(title)) > 0),
  body text not null check (char_length(trim(body)) > 0),
  overall_rating smallint not null check (overall_rating between 1 and 5),
  paid_monthly_rent integer check (
    paid_monthly_rent is null or paid_monthly_rent >= 0
  ),
  security_deposit integer check (
    security_deposit is null or security_deposit >= 0
  ),
  currency char(3) not null default 'INR',
  stay_start_date date,
  stay_end_date date,
  recommendation public.recommendation not null,
  verification_status public.review_verification_status
    not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    stay_end_date is null
    or stay_start_date is null
    or stay_end_date >= stay_start_date
  )
);

create index reviews_property_created_at_idx
  on public.reviews(property_id, created_at desc);
create index reviews_property_verification_status_idx
  on public.reviews(property_id, verification_status);

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create table public.review_category_ratings (
  review_id uuid not null references public.reviews(id) on delete cascade,
  category_id smallint not null
    references public.review_categories(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  primary key (review_id, category_id)
);

create table public.review_issues (
  review_id uuid not null references public.reviews(id) on delete cascade,
  issue public.review_issue_type not null,
  primary key (review_id, issue)
);

create table public.wishlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

create index wishlists_property_idx on public.wishlists(property_id);

create table public.review_verifications (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique
    references public.reviews(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  status public.verification_request_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  rejection_reason text
);

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null
    references public.review_verifications(id) on delete cascade,
  document_type public.verification_document_type not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index verification_documents_verification_idx
  on public.verification_documents(verification_id);

create or replace function public.sync_review_verification_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reviews
  set verification_status = case new.status
    when 'pending' then 'pending'::public.review_verification_status
    when 'verified' then 'verified'::public.review_verification_status
    when 'rejected' then 'rejected'::public.review_verification_status
  end
  where id = new.review_id;

  return new;
end;
$$;

create trigger review_verifications_sync_status
after insert or update of status on public.review_verifications
for each row execute function public.sync_review_verification_status();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'property-images',
    'property-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'verification-documents',
    'verification-documents',
    false,
    5242880,
    array['application/pdf', 'image/jpeg', 'image/png']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.review_categories enable row level security;
alter table public.reviews enable row level security;
alter table public.review_category_ratings enable row level security;
alter table public.review_issues enable row level security;
alter table public.wishlists enable row level security;
alter table public.review_verifications enable row level security;
alter table public.verification_documents enable row level security;

create policy "Profiles are publicly readable"
on public.profiles for select to anon, authenticated using (true);

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy "Published properties are publicly readable"
on public.properties for select to anon, authenticated
using (status = 'published' or created_by = auth.uid());

create policy "Authenticated users can submit properties"
on public.properties for insert to authenticated
with check (created_by = auth.uid() and status = 'pending');

create policy "Published property images are publicly readable"
on public.property_images for select to anon, authenticated
using (
  exists (
    select 1 from public.properties
    where properties.id = property_images.property_id
      and properties.status = 'published'
  )
);

create policy "Review categories are publicly readable"
on public.review_categories for select to anon, authenticated using (true);

create policy "Reviews for published properties are publicly readable"
on public.reviews for select to anon, authenticated
using (
  exists (
    select 1 from public.properties
    where properties.id = reviews.property_id
      and properties.status = 'published'
  )
);

create policy "Authenticated users can create their own reviews"
on public.reviews for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.properties
    where properties.id = reviews.property_id
      and properties.status = 'published'
  )
);

create policy "Review category ratings are publicly readable"
on public.review_category_ratings for select to anon, authenticated
using (
  exists (
    select 1 from public.reviews
    join public.properties on properties.id = reviews.property_id
    where reviews.id = review_category_ratings.review_id
      and properties.status = 'published'
  )
);

create policy "Authors can add ratings to their own reviews"
on public.review_category_ratings for insert to authenticated
with check (
  exists (
    select 1 from public.reviews
    where reviews.id = review_category_ratings.review_id
      and reviews.author_id = auth.uid()
  )
);

create policy "Review issues are publicly readable"
on public.review_issues for select to anon, authenticated
using (
  exists (
    select 1 from public.reviews
    join public.properties on properties.id = reviews.property_id
    where reviews.id = review_issues.review_id
      and properties.status = 'published'
  )
);

create policy "Authors can add issues to their own reviews"
on public.review_issues for insert to authenticated
with check (
  exists (
    select 1 from public.reviews
    where reviews.id = review_issues.review_id
      and reviews.author_id = auth.uid()
  )
);

create policy "Users can read their own wishlists"
on public.wishlists for select to authenticated using (user_id = auth.uid());

create policy "Users can add their own wishlists"
on public.wishlists for insert to authenticated with check (user_id = auth.uid());

create policy "Users can remove their own wishlists"
on public.wishlists for delete to authenticated using (user_id = auth.uid());

create policy "Users can read their own verification requests"
on public.review_verifications for select to authenticated
using (created_by = auth.uid());

create policy "Review authors can submit verification requests"
on public.review_verifications for insert to authenticated
with check (
  created_by = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.reviews
    where reviews.id = review_verifications.review_id
      and reviews.author_id = auth.uid()
  )
);

create policy "Users can read their own verification document metadata"
on public.verification_documents for select to authenticated
using (
  exists (
    select 1 from public.review_verifications
    where review_verifications.id = verification_documents.verification_id
      and review_verifications.created_by = auth.uid()
  )
);

create policy "Users can add documents to their own verification request"
on public.verification_documents for insert to authenticated
with check (
  exists (
    select 1 from public.review_verifications
    where review_verifications.id = verification_documents.verification_id
      and review_verifications.created_by = auth.uid()
  )
);

create policy "Users can read their own verification files"
on storage.objects for select to authenticated
using (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = 'review-verifications'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Users can upload their own verification files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = 'review-verifications'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Users can delete their own verification files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = 'review-verifications'
  and (storage.foldername(name))[2] = auth.uid()::text
);
