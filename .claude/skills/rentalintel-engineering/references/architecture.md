# Architecture

Full detail: CLAUDE.md §4–§6. This is the quick-lookup version.

## Request flow

```
Browser
  -> Next.js App Router (Server Components read Supabase directly)
  -> Server Actions ("use server", app/actions/*.ts) handle all writes
  -> Supabase client (@supabase/ssr)
  -> Postgres + Auth + Storage, authorized via Row Level Security
```

- No custom API layer between pages and Supabase. `page.tsx` files query Supabase directly in Server Components.
- `proxy.ts` (Next 16's renamed `middleware.ts`) runs on every non-static request, calls `supabase.auth.getUser()`, and refreshes session cookies.
- Authorization is enforced primarily by Postgres RLS, not application code — see `security.md`.

## `lib/` — what each helper owns

| File | Owns |
|---|---|
| `supabase/client.ts` / `supabase/server.ts` | Browser / cookie-aware server Supabase clients |
| `property-discovery.ts` | The aggregation query behind homepage + `/property` listing (`getDiscoveryProperties`) |
| `property-format.ts` | Shared image-URL / rating-average / currency formatting |
| `cities.ts` | Single source of truth for city/locality data (`DEFAULT_CITY`, `CITIES`, `LOCALITIES_BY_CITY`, alias resolution) |
| `area-coordinates.ts` | Approximate area-centroid coordinates + nearest-neighbor lookups (map markers, "Use My Location") |
| `geolocation.ts` | Thin Promise wrapper around `navigator.geolocation` |
| `auth.ts` | `requireUser()` — the shared auth-check helper every Server Action calls first |
| `admin.ts` | `isAdminUser()` / `requireAdmin()` — admin-membership check (queries `admin_users`) |
| `property-attributes.ts` | Canonical configuration/property-type/furnishing/contact-method vocab, mirroring Postgres enums exactly |
| `property-roles.ts` | Canonical submitter-role vocab (`owner`/`tenant`/`helper`) — deliberately not `"use client"`, so a Server Component can import it directly |
| `embedded.ts` | `one()` — normalizes a PostgREST embedded relationship that can come back as an object *or* an array depending on cardinality (see gotcha below) |
| `uploads.ts` | Upload validation/cleanup/signature-verification for property images and verification docs |
| `safe-next-path.ts` | Open-redirect guard for `?next=` params |
| `auth-client.ts` | Shared Google OAuth kickoff (client-side) |

**One data-access helper per concern.** If you need a new cross-page query, check whether an existing `lib/` file already owns that concern before adding a new one or duplicating logic inline in a `page.tsx`.

## A real gotcha: PostgREST embed cardinality

`lib/embedded.ts`'s `one()` exists because PostgREST returns a many-to-one embed (a review's property, a verification's review) as an **object**, and a one-to-many embed as an **array** — code that assumes array-always and reads `.properties[0]` gets `undefined` silently (no error), which previously made property links vanish from account pages and reviewer names fall back to "RentalIntel member" with no visible failure. Any new query with an embedded relationship should go through `one()` rather than re-deriving this by hand.

## Homepage state ownership

`HomeDiscovery.tsx` is the single owner of homepage search/filter/map state (city, area, query, rent range, only-show filters, selected property, map center/zoom). `SearchBar`, the property panel toolbar, and `PropertyMap` are siblings that read/write through it — they don't keep independent copies. `filterProperties()` (exported from `PropertyDiscovery.tsx`) is called once per render and its result is handed to both the map and the list.
