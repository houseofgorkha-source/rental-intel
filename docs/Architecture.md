# RentalIntel Architecture

## Purpose

Defines how the application is structured and how components interact.

---

## Current Folder Structure

```text
app/
components/
data/
docs/
public/
```

---

## Planned Structure

```text
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

---

## Responsibilities

- app/: Pages, layouts and routing
- components/: Reusable UI components
- data/: Temporary local data (replaced by the database)
- docs/: Product documentation
- public/: Static assets

---

## Routing

```text
/
→ Homepage

/property/[slug]
→ Property Details

/property/[slug]/review
→ Write Review

/property/[slug]/review/success
→ Review Submitted

/add-property
→ Add Property
```

---

## Current Models

### Property

**Current**

- slug
- name
- location
- trustScore
- rent
- depositExperience
- societyRules
- nearby[]

**Future**

- rentalIntelId
- aliases[]
- coordinates
- placeId
- ownerHistory
- verificationStatus

---

### Review

**Current**

- id
- propertySlug
- reviewer
- title
- review
- rating
- stay
- verified

**Future**

- evidence
- moderationStatus
- createdAt
- updatedAt

---

## Design Rules

- Pages fetch and compose data.
- Components render UI.
- Data should have a single source of truth.
- Avoid duplicating business logic.
- Keep components reusable and focused.

---

## Principles

- One source of truth.
- Pages never own data.
- Components should remain reusable.
- Business logic should move into `lib/` over time.
- Keep data models independent of UI.

---

## Data Flow

```text
User
   ↓
Page
   ↓
Component
   ↓
Supabase
   ↓
Database
```

---

## Future Architecture

```text
Browser
   ↓
Next.js
   ↓
Supabase
├── PostgreSQL
├── Authentication
└── Storage
```

---

This document evolves with RentalIntel.
