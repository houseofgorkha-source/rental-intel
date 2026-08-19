# To-Let Vision — Ola Maps Street View prototype

Isolated experiment. Not wired into the RentalIntel app, database, or migrations.
Goal of this step only: one Bangalore coordinate -> Ola Maps Street View API ->
one saved local image.

## Setup

1. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. Set your key in `.env`:
   ```
   OLA_MAPS_API_KEY=your-key-here
   ```
   The key is read from the `OLA_MAPS_API_KEY` environment variable only.
   It is never hard-coded, never committed (`.env` is git-ignored), and never
   referenced from any client/browser code — this is a Node-only script.
3. Also set `OLA_STREET_VIEW_BASE_URL` and fill in the three endpoint paths
   in `src/olaStreetView.js` (`ENDPOINTS.nearestImageId`, `.metadata`,
   `.coverage`). These are **not yet confirmed** — see "Current status" below.

## Run

```
node --env-file=.env src/testOneCoordinate.js
```

This makes at most 3 requests (nearest-image lookup, metadata, image bytes)
against a single hard-coded Bangalore coordinate. It does not loop or scan.

## Current status

The Ola Maps Street View docs (`https://maps.olakrutrim.com/docs/street-view`)
confirm three endpoints exist, by description only:

- **Coverage** — returns a LineString of available street-view imagery inside
  an input bounding box.
- **Nearest image** — returns the `ImageId` of the nearest street-view image
  to a given lat/lng, with an optional radius (meters).
- **Metadata** — returns `{ latitude, longitude, bearing, imageUrl, links }`
  for a given `ImageId`. `imageUrl` is how the actual image is retrieved —
  there is no separately documented "image" endpoint.

The exact URL paths, base domain, and API-key parameter (query vs header)
could not be extracted automatically — that part of the docs site renders its
code samples client-side via JS, which isn't visible to automated fetching.
`src/olaStreetView.js` refuses to run against guessed endpoints (it throws a
clear error naming what's missing) rather than firing requests at invented
URLs. Fill in the confirmed values from the docs page's "Sample Request" tabs
or the Krutrim cloud console before running.
