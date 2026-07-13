# RentalIntel Architecture

## Purpose

Defines how the application is structured and how components interact.

## Current Folder Structure

``` text
app/
components/
data/
docs/
public/
```

## Planned Structure

``` text
app/
components/
data/
docs/
lib/
types/
utils/
database/
api/
```

## Responsibilities

-   app/: Pages and routing
-   components/: Reusable UI
-   data/: Shared data models (temporary, replaced by DB later)
-   docs/: Product documentation

## Current Data Models

### Property

-   slug
-   name
-   location
-   trustScore
-   rent
-   depositExperience
-   societyRules
-   nearby\[\]

Future: - rentalIntelId - aliases\[\] - coordinates - placeId -
ownerHistory - verificationStatus

### Review

-   id
-   propertySlug
-   reviewer
-   rating
-   title
-   review
-   stay
-   verified

Future: - evidence - moderationStatus - createdAt - updatedAt

## Principles

-   One source of truth.
-   Pages never own data.
-   Components are reusable.
-   Business logic should move into lib/ over time.

## Future Architecture

Browser ↓ Next.js ↓ API ↓ Database ↓ Storage
