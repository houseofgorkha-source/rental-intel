# RentalIntel Master Context v1

**Version:** v1\
**Status:** Active

## Purpose

This document preserves the product vision, architecture, roadmap,
design philosophy, coding standards, milestones, and current state of
RentalIntel. It is the primary context document used when continuing
development in a new chat.

## Vision

To become the world's most trusted rental intelligence platform.

RentalIntel preserves rental history so valuable tenant experiences stay
with the property instead of disappearing every time someone moves out.

## Mission

Help tenants make informed rental decisions through community knowledge,
verified reviews and trustworthy property intelligence.

## Core Principles

-   Trust over growth
-   One RentalIntel ID per property
-   Evidence-backed reviews
-   Verification increases credibility, not the right to be heard
-   Data quality over quantity
-   Build for tenants first

## Brand

-   Background: White (#FFFFFF)
-   Text: Black (#111827)
-   Accent: Blue (#2563EB)

Normal actions: - White outlined buttons - Blue on hover

High impact actions: - Solid blue buttons

## Current Project

Completed: - Homepage - Search - Property page - Review flow - Review
success - Add Property foundation - Documentation - GitHub

Current sprint: - Brand migration - UI polish - Shared components

## Folder Structure

app/ components/ data/ docs/ public/

Feature folders: - review - add-property - shared

## Current Shared Components

-   Button

## Add Property Components

-   PropertyForm
-   InputField
-   TextAreaField
-   SectionTitle
-   InfoCard

## Review Components

-   ReviewForm
-   StarRating
-   reviewCategories

## Version 1 Decisions

-   Manual property submission
-   Manual verification
-   Google Login only
-   Google Maps postponed to Version 2
-   RentalIntel ID assigned after verification

## Version 2

-   Google Maps
-   Property Fingerprint
-   AI Review Summaries
-   Helpful Votes
-   Review Threads
-   Alias Detection
-   Duplicate Detection

## Coding Philosophy

-   Pages orchestrate
-   Components render
-   Reuse before rewrite
-   Shared components only when reused
-   Business logic belongs in lib/

## Product Philosophy

Every feature must answer:

"Does this help someone make a better rental decision?"

## Working Style

Think → Design → Code → Test → Commit → Push → Update Documentation

## Next

-   Finish Brand Migration
-   Login UI
-   Profile UI
-   Shared Card
-   Shared Modal
-   Shared Badge

## Notes

Future versions (v2, v3, ...) should extend this document instead of
replacing it.

Om Namah Shivaya.
