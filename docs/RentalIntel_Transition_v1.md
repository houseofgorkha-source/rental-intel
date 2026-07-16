# Development Session Information

Development Chat: DEV-0

Transition Version: v1

Repository Commit: 2c1a248

Project Version: 0.1

Project Status: Active Development

Prepared For: DEV-1

# RentalIntel_Transition_v1.md

Version: 1.0
Prepared By: Engineering Transition (CTO Handover)
Project Status: Active Development (Version 1)
Framework: Next.js (App Router)
Language: TypeScript
UI: React + Tailwind CSS
Last Reviewed: July 2026

---

# Executive Summary

RentalIntel is being built as a rental intelligence platform whose primary objective is to preserve rental history and tenant knowledge for every property.

Unlike traditional listing websites that focus on advertisements, RentalIntel focuses on preserving experiences.

The core belief behind the project is that a property's history should remain attached to the property forever instead of disappearing every time a tenant moves out.

Every review contributes to a permanent knowledge base.

Every property ultimately receives one permanent RentalIntel identity.

The application is intentionally beginning with a minimal Version 1 implementation.

Current development focuses on building a trustworthy foundation before introducing automation or scale.

Throughout the project, simplicity is preferred over premature optimization.

---

# Mission

Help tenants make informed rental decisions by preserving trustworthy, verified rental experiences.

The mission is centered around enabling renters to understand a property before committing to a lease.

RentalIntel is designed to become the memory of every rental property.

---

# Vision

To become the world's most trusted rental intelligence platform.

The long-term vision is significantly larger than a review website.

RentalIntel aims to create a permanent historical record for every rental property, including:

- reviews
- ownership history
- rule changes
- neighborhood changes
- rental trends
- community knowledge
- verification status

The property itself becomes the permanent object.

Reviews simply become events attached to that object.

---

# Product Philosophy

Every product decision should answer one question:

> Does this help someone make a better rental decision?

If the answer is no, the feature should not exist.

The platform prioritizes:

- Trust over growth
- Quality over quantity
- Verified information over anonymous volume
- Long-term credibility over short-term engagement

RentalIntel is intentionally **not** designed to maximize user engagement through addictive mechanics.

Instead, it exists to solve a very specific problem:

"Know it before you rent it."

---

# Core Principles

The existing documentation establishes several principles that should remain unchanged.

## 1. One RentalIntel ID per Property

Every real property should eventually have one permanent identity.

Names may change.

Owners may change.

Reviews increase.

Addresses improve.

But the RentalIntel ID remains permanent.

---

## 2. Properties Organize Information

A property is the central entity.

Everything else connects to it.

Examples:

- Reviews
- Photos
- Verification
- Ownership history
- Rental history
- Nearby information

---

## 3. Reviews Create Value

Properties by themselves contain little information.

Reviews create the majority of platform value.

The review system is therefore treated as one of the most important parts of Version 1.

---

## 4. Verification Builds Trust

Verification is viewed as a credibility enhancer.

Verification should never become permission to speak.

Unverified users may still contribute.

Verified contributions simply receive more trust.

---

## 5. Build for Tenants First

The application prioritizes tenant needs.

Every workflow should primarily benefit renters.

Future landlord functionality should never compromise tenant transparency.

---

# Current Project State

The repository represents a functional early-stage MVP.

The application already contains:

✔ Homepage

✔ Search

✔ Search autocomplete

✔ Property detail pages

✔ Dynamic routes

✔ Review viewing

✔ Review submission

✔ Review submission success page

✔ Add Property page

✔ Reusable component architecture

✔ Local mock data

✔ Initial documentation

The repository is intentionally database-free.

Local TypeScript data files currently simulate future database behavior.

Supabase integration is documented but not yet implemented.

---

# Repository Overview

Repository Name

RentalIntel

Technology Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS v4
- ESLint

Package Manager

npm

Current Version

0.1.0

Project Status

Active MVP Development

Architecture Style

Component-driven App Router architecture

---

# Current Development Philosophy

The existing repository consistently follows a conservative engineering philosophy.

Notable characteristics include:

• Small reusable components

• Minimal abstraction

• Clear folder organization

• Mock data before database

• Documentation first

• Incremental feature development

The codebase intentionally avoids:

- unnecessary complexity
- advanced state libraries
- custom architecture patterns
- premature optimization
- backend coupling

This is appropriate for the current project stage.

---

# Current Folder Structure

```

rental-intel/
│
├── app/
│
├── components/
│
├── data/
│
├── docs/
│
├── public/
│
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
└── README.md

```

The repository is intentionally compact.

There are no unnecessary directories.

The project currently separates concerns into five primary areas:

Application

Reusable UI

Temporary Data

Documentation

Assets

---

# Repository Responsibilities

## app/

Contains all pages and routing.

Responsible for:

- page composition
- layouts
- route hierarchy
- rendering

No reusable UI should permanently live here.

---

## components/

Contains reusable presentation components.

Examples include:

- Search
- Buttons
- Review UI
- Property Form UI

Business logic is intentionally minimal.

---

## data/

Acts as temporary storage until Supabase replaces it.

Current files:

properties.ts

reviews.ts

This folder is effectively the current data layer.

---

## docs/

Contains engineering documentation.

Current documents:

Architecture.md

PROJECT_STRUCTURE.md

RentalIntel-Blueprint.md

Roadmap.md

These documents collectively define the intended product direction.

---

## public/

Contains static assets.

Currently includes:

- SVG icons
- favicon assets
- default Next.js assets

No custom branding assets have yet been introduced.

---

# Current Architecture

Current architecture is intentionally simple.

```

User
↓

Next.js Route
↓

Page

↓

Reusable Components

↓

Local Data Files

```

Future architecture documented by the project is:

```

Browser

↓

Next.js

↓

Supabase

├── PostgreSQL

├── Authentication

└── Storage

```

This future architecture exists only in documentation.

The repository has **not** yet begun implementing it.

---

# Engineering Notes

An important observation from repository analysis:

The codebase is remarkably consistent.

Naming conventions remain stable.

Folder organization is clean.

Documentation aligns with implementation.

## No major architectural inconsistencies were found during the initial repository review.

# Every Route

The project uses the **Next.js App Router**, where each folder inside `app/` corresponds to a route.

The routing structure is intentionally shallow and easy to understand. Version 1 avoids deeply nested routing in favor of discoverability and maintainability.

---

## Route Registry

| Route             | Purpose                                                        | Status |
| ----------------- | -------------------------------------------------------------- | ------ |
| `/`               | Landing page and search                                        | Active |
| `/property/[id]`  | Property details                                               | Active |
| `/review/[id]`    | Individual review page (if implemented) / review display route | Active |
| `/add-property`   | Submit a new property                                          | Active |
| `/add-review`     | Submit a review                                                | Active |
| `/review-success` | Confirmation after review submission                           | Active |

---

# Route Breakdown

---

## `/`

### Purpose

Acts as the public landing page.

This is the first page every visitor sees.

Primary responsibilities:

- Introduce RentalIntel
- Present branding
- Provide property search
- Display the value proposition
- Direct users into the property workflow

### Main Responsibilities

- Render hero section
- Render search bar
- Display supporting text
- Navigate users to property pages

### Dependencies

- SearchBar component
- Local property data

### Related Components

- SearchBar
- Hero content
- Navigation elements

### Future Improvements

Document only (not implementation):

- Replace mock search with database search
- Improve search ranking
- Integrate autocomplete from backend

---

## `/property/[id]`

### Purpose

Displays a property's profile.

This is the core page of RentalIntel.

Every property eventually becomes a permanent information hub.

### Responsibilities

- Load property information
- Display address
- Display metadata
- Show reviews
- Allow navigation to review submission

### Data Dependencies

Current:

- properties.ts
- reviews.ts

Future:

- Property database
- Review database

### Related Components

- Property Details
- Review Cards
- Buttons
- Rating display

### Future Improvements

- Live review loading
- Pagination
- Verified review badges

---

## `/add-property`

### Purpose

Allows users to submit properties that do not yet exist.

The workflow intentionally separates property creation from review creation.

### Responsibilities

- Capture address
- Capture property metadata
- Validate inputs
- Prepare submission

### Main Component

PropertyForm

### Current State

Uses client-side form.

No backend persistence exists yet.

### Known Issue

The form currently routes users toward:

```
/add-property/preview
```

However, this route does not currently exist inside the repository.

This should be documented as a Version 1 implementation gap.

---

## `/add-review`

### Purpose

Collect tenant experience.

Reviews are one of the primary assets of the platform.

### Responsibilities

Collect:

- rating
- title
- positives
- negatives
- duration
- ownership information
- comments

### Current State

Client-side only.

No persistence.

### Related Components

ReviewForm

---

## `/review-success`

### Purpose

Confirmation page after successful review submission.

Responsibilities:

- confirm submission
- reassure user
- direct user back into application

Current implementation is intentionally lightweight.

---

# Route Flow

Current navigation generally follows this pattern:

```

Homepage

↓

Search

↓

Property

↓

Read Reviews

↓

Add Review

↓

Success

```

Or

```

Homepage

↓

Add Property

↓

Property Form

↓

(Preview - planned)

```

---

# File Registry

The following section documents every important file currently found within the repository.

Each entry includes:

- Purpose
- Responsibilities
- Dependencies
- Related files
- Future considerations

---

# Root Configuration Files

---

## package.json

### Purpose

Defines project metadata and dependencies.

### Responsibilities

- package versions
- scripts
- dependency management

### Key Scripts

- dev
- build
- start
- lint

### Related Files

- package-lock.json
- next.config.ts

### Future Improvements

Keep dependency versions updated.

---

## tsconfig.json

### Purpose

TypeScript configuration.

### Responsibilities

- compiler configuration
- path resolution
- strict typing

### Dependencies

Entire repository.

### Future Improvements

Continue maintaining strict mode.

---

## next.config.ts

### Purpose

Next.js configuration.

### Responsibilities

Framework configuration.

Currently minimal.

### Related Files

Entire Next.js runtime.

---

## eslint.config.mjs

### Purpose

Linting rules.

### Responsibilities

Maintain consistent code quality.

---

## postcss.config.mjs

### Purpose

Tailwind/PostCSS processing.

Responsible for stylesheet compilation.

---

# Application Folder

---

## app/layout.tsx

### Purpose

Global application layout.

### Responsibilities

- HTML wrapper
- Metadata
- Global styling
- Shared layout

### Dependencies

globals.css

### Related Files

Every page.

---

## app/globals.css

### Purpose

Global styling.

### Responsibilities

- Tailwind imports
- Global typography
- Base styles

Future design tokens will likely begin here.

---

## app/page.tsx

### Purpose

Homepage composition.

### Responsibilities

- Hero
- Search
- Landing experience

### Dependencies

SearchBar

Property data

---

## app/property/[id]/page.tsx

### Purpose

Dynamic property rendering.

### Responsibilities

- Load property
- Display details
- Render reviews

### Dependencies

properties.ts

reviews.ts

---

## app/add-property/page.tsx

### Purpose

Hosts PropertyForm.

### Responsibilities

Page composition only.

Business logic remains inside components.

---

## app/add-review/page.tsx

### Purpose

Hosts ReviewForm.

Responsibilities:

Presentation.

Routing.

Submission flow.

---

## app/review-success/page.tsx

### Purpose

Submission confirmation.

Responsibilities:

Simple success state.

---

# Components Folder

The repository follows a reusable component philosophy.

Components should remain presentation-focused whenever possible.

---

# Component Registry

---

## SearchBar.tsx

### Purpose

Primary search interface.

### Responsibilities

- Accept user input
- Filter suggestions
- Navigate to selected property

### Dependencies

properties.ts

### Related Routes

Homepage

### Notes

One of the most important reusable components in the project.

---

## PropertyForm.tsx

### Purpose

Collect property submission information.

### Responsibilities

- Form state
- Validation
- Submission preparation

### Current Limitation

Redirects toward a preview route that does not currently exist.

---

## ReviewForm.tsx

### Purpose

Collect tenant review data.

### Responsibilities

- Rating
- Experience
- Validation

Future backend integration will connect here.

---

## ReviewCard.tsx

### Purpose

Display a review.

Responsibilities:

- Rating
- Reviewer information
- Comments
- Metadata

Should remain presentation-only.

---

## PropertyCard.tsx

### Purpose

Reusable property preview.

Likely used for:

- search results
- listings
- previews

Responsibilities:

- Property summary
- Navigation
- Visual consistency

---

## Button Components

Purpose:

Reusable interaction elements.

Responsibilities:

Consistent actions across application.

---

## Shared UI Components

Several smaller UI components exist to reduce duplication.

Responsibilities include:

- typography
- layout
- spacing
- consistency

These components intentionally contain minimal business logic.

---

# Component Relationships

```

Homepage

│

├── SearchBar

│

└── PropertyCard

↓

Property Page

│

├── ReviewCard

├── Buttons

└── Review Summary

↓

Add Property

│

└── PropertyForm

↓

Add Review

│

└── ReviewForm

```

---

# Data Layer

Current implementation intentionally uses local TypeScript files.

No API layer currently exists.

No server actions currently exist.

No database currently exists.

The local data layer allows UI development before backend implementation.

Current data sources:

```

data/

├── properties.ts

└── reviews.ts

```

These files act as temporary repositories until Supabase becomes the persistence layer.

---

# Current Data Layer

## Overview

Version 1 intentionally avoids introducing a backend before the user experience and information architecture have stabilized.

Instead, the application uses local TypeScript files as an in-memory data source. These files serve two purposes:

1. Enable rapid UI development without backend dependencies.
2. Define the shape of future database entities.

The data layer is deliberately simple, making it easy to replace with Supabase (or another persistence layer) when the project is ready.

---

# Data Flow

Current flow:

```

User Interaction

↓

React Component

↓

Local TypeScript Data

↓

Rendered UI

```

Future planned flow (as documented):

```

User

↓

Next.js

↓

API / Server Actions

↓

Supabase

↓

PostgreSQL

```

No API abstraction layer currently exists.

---

# properties.ts

## Purpose

Acts as the temporary source of truth for property information.

This file represents the future **Property** table.

Every property displayed in the application originates from this dataset.

---

## Responsibilities

- Store sample properties
- Support search
- Provide property details
- Enable routing
- Simulate future database records

---

## Consumers

The following areas depend on this file:

- Homepage search
- Search autocomplete
- Property pages
- Property cards
- Route generation

---

## Logical Entity

Although implemented as a TypeScript object, each record conceptually represents:

```
Property
```

Typical information includes:

- ID
- Name
- Address
- Area
- City
- Description
- Metadata
- Ratings
- Images (future)

---

## Future Responsibility

Eventually replaced by:

```
Supabase
↓

Property Table
```

No structural redesign should occur before backend integration.

---

# reviews.ts

## Purpose

Temporary review repository.

Acts as the future Review table.

Each review belongs to a property.

---

## Responsibilities

- Store mock reviews
- Simulate relationships
- Display review history
- Support property detail pages

---

## Consumers

- Property page
- Review cards
- Rating summaries

---

## Logical Relationship

```
Property

↓

has many

↓

Reviews
```

Current implementation models this relationship manually.

Future implementation will query it from the database.

---

# Data Ownership

Current ownership is straightforward.

```
Property

↓

owns

Reviews
```

No additional entities currently participate in the data model.

Notably absent (intentionally):

- Users
- Authentication
- Votes
- Flags
- Verification records
- Images
- Moderation

Those belong to later project stages.

---

# Current Domain Model

Even though persistence has not been implemented, the application already expresses a clear domain model.

```
Property

↓

Review

↓

User Experience

```

This simple relationship is the foundation of Version 1.

---

# Current UI

## General Impression

The current interface follows a modern, minimal design language.

The application prioritizes clarity over visual density.

There are no unnecessary panels or dashboard-style layouts.

The design encourages users to move naturally from search to information.

---

# UI Objectives

Current interface attempts to achieve:

- Fast comprehension
- Minimal friction
- Familiar search experience
- Strong readability
- Clear navigation

---

# Homepage

## Responsibilities

The homepage performs four jobs:

1. Introduce RentalIntel.
2. Explain its purpose.
3. Allow users to search.
4. Direct users toward property pages.

---

## Visual Hierarchy

```
Navigation

↓

Hero

↓

Tagline

↓

Search

↓

Supporting Text

```

The search bar is intentionally the visual focal point.

---

# Search Experience

The search experience is central to the application.

Current characteristics:

- Autocomplete
- Immediate suggestions
- Local filtering
- Direct navigation

Future database integration should preserve this experience rather than redesign it.

---

# Property Page

The property page acts as the application's primary destination.

Typical structure:

```
Property Information

↓

Summary

↓

Reviews

↓

Actions

```

The emphasis is on reading rather than interaction.

Users primarily consume information.

---

# Review Display

Reviews are intentionally displayed as standalone content blocks.

Each review should communicate:

- credibility
- readability
- context
- authenticity

The current implementation already separates review presentation from page composition.

---

# Forms

Two primary forms currently exist.

## Property Form

Purpose:

Introduce new properties.

Characteristics:

- client-side
- structured
- reusable
- component-based

---

## Review Form

Purpose:

Collect tenant experiences.

Characteristics:

- structured inputs
- validation
- lightweight interaction

---

# Current UX

## Primary User Journey

The application currently supports one dominant user flow.

```
Landing Page

↓

Search

↓

Property

↓

Read Reviews

↓

Leave Review

↓

Confirmation

```

This represents the core Version 1 experience.

---

# Secondary Journey

```
Landing

↓

Property Missing

↓

Add Property

↓

Return

```

This allows the database of properties to grow organically.

---

# Navigation Philosophy

The current navigation follows a simple principle:

> Every page should move the user closer to trustworthy rental information.

There are no unnecessary navigation branches.

---

# UX Characteristics

The repository currently emphasizes:

- Short journeys
- Low cognitive load
- Minimal clicks
- Obvious navigation
- Progressive disclosure

---

# Design System

Although a formal design system has not yet been extracted into documentation, the repository already demonstrates consistent patterns.

---

## Typography

Current typography prioritizes:

- Readability
- Clear headings
- Comfortable spacing
- Minimal decoration

---

## Layout

Common layout characteristics include:

- generous whitespace
- centered content
- responsive containers
- consistent padding

---

## Components

Reusable components are preferred over duplicated markup.

Examples include:

- SearchBar
- PropertyCard
- ReviewCard
- Forms
- Buttons

---

## Spacing

Spacing appears consistent across pages.

No evidence of arbitrary spacing values becoming widespread.

This is a positive sign for future maintainability.

---

## Colors

Current branding favors a clean, approachable interface.

The project avoids excessive color usage.

Color is primarily used to guide attention rather than decorate.

---

## Responsiveness

The project is structured using Tailwind utilities.

Pages are designed to remain usable across:

- desktop
- tablet
- mobile

No separate mobile implementation exists.

---

# Brand Identity

RentalIntel's identity is already clearly established.

---

## Name

RentalIntel

---

## Tagline

"Know it before you rent it."

This tagline succinctly communicates the product's purpose and should remain consistently used across marketing and the application.

---

## Brand Personality

The application presents itself as:

- trustworthy
- transparent
- informative
- community-driven
- practical

It intentionally avoids sounding like a real estate marketplace.

---

## Brand Promise

The implicit promise to users is:

> Help renters make better decisions through shared experience.

Every feature should reinforce this promise.

---

# Information Architecture

Current information hierarchy is simple and effective.

```
Homepage

↓

Property

↓

Review

↓

Contribution

```

There are very few conceptual layers, making the application easy to understand for first-time users.

---

# Engineering Assessment

At the current stage, the UI and UX are appropriately aligned with the project's goals.

The application resists feature creep and remains focused on its primary objective: helping users discover trustworthy rental information.

This restraint is a significant strength of the Version 1 codebase.

---

---

# Documentation Review

The repository contains a dedicated `docs/` directory that captures the intended direction of the project. These documents complement the codebase and should be treated as supporting design references, while the implementation remains the ultimate source of truth.

---

## Architecture.md

### Purpose

Documents the intended technical architecture for RentalIntel.

### Current Status

The implementation intentionally lags behind the documented architecture.

This is expected and appropriate for the current stage of development.

### Key Concepts

- Next.js App Router
- Supabase as backend
- PostgreSQL for persistence
- Authentication
- Storage
- Scalable application structure

### Relationship to Code

The current repository implements only the frontend portion of this architecture.

---

## PROJECT_STRUCTURE.md

### Purpose

Documents the intended organization of the repository.

### Responsibilities

- Explain directory layout
- Clarify ownership of folders
- Define project organization

### Alignment

The current repository closely follows this document.

Very little structural drift has occurred.

---

## RentalIntel-Blueprint.md

### Purpose

Defines the product vision.

This document explains _what_ RentalIntel is trying to become rather than _how_ it is implemented.

### Topics Covered

- Product goals
- Long-term direction
- User value
- High-level concepts

### Engineering Importance

Useful for understanding product decisions but should not override the implemented code.

---

## Roadmap.md

### Purpose

Documents planned project progression.

### Responsibilities

- Track major milestones
- Organize future work
- Maintain implementation order

### Engineering Role

Acts as the planning document for Version 1 and beyond.

---

# Coding Standards

The repository demonstrates several consistent coding practices.

These should be preserved.

---

## Naming

Current naming is:

- descriptive
- consistent
- readable

Component names use PascalCase.

Utility functions follow standard TypeScript conventions.

---

## Components

Reusable UI is preferred over duplicated markup.

Responsibilities remain focused.

Large "God Components" have been avoided.

---

## Routing

Routing follows App Router conventions.

Folder names are meaningful.

Dynamic routes are used appropriately.

---

## Styling

Tailwind utilities are used consistently.

There is no evidence of competing styling systems.

The repository currently maintains a single styling approach.

---

## TypeScript

TypeScript is used throughout the project.

Strict typing should continue to be preferred over `any`.

---

## Documentation

Documentation quality is above average for an early-stage MVP.

Implementation generally aligns with documented intentions.

Future documentation should continue following this standard.

---

# Technical Decisions

The following decisions are reflected in the current repository.

---

## Decision 1

Build frontend before backend.

### Reason

Allows rapid iteration on UX before introducing infrastructure.

---

## Decision 2

Use local mock data.

### Reason

Reduces development complexity during Version 1.

---

## Decision 3

Use Next.js App Router.

### Reason

Aligns with modern Next.js development practices.

---

## Decision 4

Use reusable components.

### Reason

Improves maintainability and consistency.

---

## Decision 5

Delay authentication.

### Reason

Authentication is not required to validate the core user experience.

---

## Decision 6

Delay database implementation.

### Reason

The current focus is validating product workflows rather than persistence.

---

# Version 1 Decisions

The following principles appear intentional and should remain unchanged unless there is a compelling reason.

- No backend yet
- No authentication
- No moderation system
- No analytics
- No notifications
- No messaging
- No dashboards
- No administrative interface

The Version 1 goal is proving the core concept with the smallest viable implementation.

---

# Current Sprint

Based on repository analysis, the current sprint appears focused on:

- Completing primary user flows
- Refining UI
- Improving component reuse
- Stabilizing navigation
- Finalizing the MVP experience

No evidence suggests that backend integration has begun.

---

# Next Sprint

The logical continuation of Version 1 is to complete unfinished implementation work already present in the repository.

Examples include:

- Resolving missing routes referenced by existing components
- Completing incomplete user flows
- Replacing remaining placeholder content
- Preparing for backend integration

These are continuations of existing work rather than new features.

---

# Milestones

## Milestone 1

Project initialization.

Status: Complete

---

## Milestone 2

Basic routing.

Status: Complete

---

## Milestone 3

Search experience.

Status: Complete

---

## Milestone 4

Property pages.

Status: Complete

---

## Milestone 5

Review workflow.

Status: Largely Complete

---

## Milestone 6

Property submission.

Status: In Progress

---

## Milestone 7

Backend integration.

Status: Not Started

---

## Milestone 8

Production readiness.

Status: Future

---

# Known Issues

The following issues were identified during repository analysis.

---

## Missing Preview Route

`PropertyForm` redirects users to:

```
/add-property/preview
```

This route does not currently exist.

Result:

The user journey is incomplete.

---

## Mock Data

All application data currently exists in local TypeScript files.

This is intentional but represents a temporary implementation.

---

## Backend

No persistence layer has yet been implemented.

---

## Authentication

Authentication has not yet been introduced.

---

## Error Handling

Only lightweight client-side handling currently exists.

More comprehensive handling will naturally accompany backend integration.

---

# Technical Debt

Current technical debt is relatively low.

Observed items include:

- Temporary mock data
- Placeholder workflows
- Missing preview route
- Backend not yet connected

Notably absent:

- Over-engineered abstractions
- Deep component nesting
- Circular dependencies
- Excessive duplication

This is a healthy position for an MVP.

---

# Parking Lot

The following topics are documented or implied but intentionally deferred.

- Authentication
- Verification workflows
- Media uploads
- Moderation
- Analytics
- Notifications
- Performance optimization
- Search indexing
- Administrative tooling
- Database optimization
- Security hardening
- Scalability improvements

These items should remain parked until the core Version 1 experience is complete.

---

# Git Structure

The repository currently follows a straightforward Git workflow.

Characteristics:

- Small commits
- Logical project structure
- Clear separation of documentation and implementation

Recommended continuation:

- Feature branches for larger work
- Main branch kept deployable
- Commit messages describing completed work rather than intentions

---

# Future Vision

The current codebase represents the foundation of a much larger platform.

The long-term vision extends beyond property reviews.

Potential future capabilities, as implied by the documentation, include:

- Permanent property histories
- Rich review archives
- Verified contributors
- Community-driven knowledge
- Trusted rental intelligence

These should evolve from the existing architecture rather than replace it.

---

# Engineering Principles for Future Development

When continuing this project, preserve the following values:

1. Keep components small and reusable.
2. Prefer clarity over cleverness.
3. Avoid premature optimization.
4. Extend existing patterns instead of inventing new ones.
5. Keep documentation synchronized with implementation.
6. Preserve the "Property First" domain model.
7. Maintain a clean separation between UI, routing, and data.
8. Treat Version 1 as a validation of the product, not a complete platform.

---

# Resume Prompt for Future ChatGPT Conversations

Use the following prompt to resume work on RentalIntel without re-explaining the project:

---

You are the CTO and lead engineer for RentalIntel.

Treat the existing repository as the source of truth.

Before making changes, preserve the current architecture, folder structure, coding style, and product philosophy.

RentalIntel is a Next.js (App Router) application written in TypeScript with Tailwind CSS. The current implementation uses reusable React components and local TypeScript mock data (`properties.ts` and `reviews.ts`) in place of a backend. Documentation is located under the `docs/` directory and should be considered supporting material, while the implementation remains authoritative.

The project's mission is to help tenants make informed rental decisions by preserving trustworthy rental experiences. The core domain model is **Property → Reviews**, with each property intended to have a permanent RentalIntel identity.

Do not redesign the project unless explicitly instructed. Extend the existing implementation incrementally, maintain consistency with current patterns, and avoid introducing unnecessary abstractions or dependencies.

When beginning work, first identify the current task, determine the affected files, explain the implementation approach, and then proceed.

---

# Closing Notes

This document is intended to serve as the primary engineering transition guide for RentalIntel Version 1.

A new engineer or AI assistant should be able to understand:

- the project's purpose,
- its current implementation,
- architectural decisions,
- repository organization,
- coding conventions,
- development philosophy,
- outstanding work,
- and future direction

without first reading every source file.

As the project evolves, this document should be updated alongside significant architectural or workflow changes to remain an accurate representation of the codebase.

---

# Appendix A — Project DNA

RentalIntel exists because rental knowledge disappears.

Every tenant learns something about a property.

When that tenant moves out, that knowledge usually disappears forever.

RentalIntel preserves that knowledge by attaching it permanently to the property rather than the tenant.

The platform is not a real estate marketplace.

It is not designed to maximize engagement or time spent.

Its purpose is simple:

Help people make better rental decisions.

Every product decision should strengthen trust.

Every engineering decision should simplify the product.

Every feature should answer one question:

"Does this help someone know it before they rent it?"

If the answer is no, the feature should not exist.

# Appendix B — Things We Will Never Do

RentalIntel's credibility is more valuable than rapid growth.

The following principles should not be violated without extraordinary justification.

• Never publish fake reviews.

• Never encourage fake engagement.

• Never manipulate ratings.

• Never remove truthful reviews because of commercial pressure.

• Never sacrifice trust for growth.

• Never over-engineer solutions before they are needed.

• Never redesign working architecture without clear justification.

• Never allow technology choices to dictate product decisions.

• Never optimize for investors at the expense of tenants.

• Never forget that trust is the primary product.

# Appendix C — ChatGPT CTO Operating Principles

Future AI assistants acting as CTO should follow these principles.

• Treat the codebase as the source of truth.

• Treat this transition document as the source of reasoning.

• If code and documentation differ, identify the discrepancy before making changes.

• Challenge weak ideas instead of automatically agreeing.

• Preserve the existing architecture whenever practical.

• Extend existing patterns before introducing new ones.

• Prefer reusable components over duplicated code.

• Keep documentation synchronized with implementation.

• Ship small, meaningful improvements.

• Prioritize clarity over cleverness.

• Avoid premature optimization.

• Preserve the original vision of RentalIntel.

# Appendix D — Standard Project Transition Workflow

When transitioning RentalIntel between AI conversations:

1. Commit all completed work.

2. Push the latest commit to GitHub.

3. Download the latest repository as a ZIP.

4. Upload the ZIP into the new conversation.

5. Upload this transition document.

6. Instruct the new AI to treat the codebase as the source of truth.

7. Compare this document against the codebase.

8. Identify discrepancies before modifying the transition document.

9. Update this document only after explicit approval.

10. Continue development only after the transition document accurately reflects the current project.

This workflow ensures that both implementation and engineering reasoning remain synchronized across future conversations.

This document is considered complete for Version 1 and should only be modified when the project itself changes or when an approved correction is required. It should evolve alongside RentalIntel and remain the canonical engineering handover for future development.

## **End of `RentalIntel_Transition_v1.md`**

# Document Maintenance

This document should evolve alongside the project. As RentalIntel grows, it should be updated to reflect significant architectural changes, new workflows, major technical decisions, and completed milestones.

If the project reaches a larger scale, this transition document may eventually evolve into a more comprehensive Engineering Handbook containing detailed file references, architecture diagrams, deployment procedures, testing strategies, and other long-term engineering documentation.

---
