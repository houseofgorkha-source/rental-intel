# Frontend conventions

Full detail: CLAUDE.md §5, §9, §20. This is the quick-lookup version.

## Folder placement

```
components/
  shared/     Reusable primitives: Button, InputField, TextAreaField, SelectField,
              AuthCard, AuthHeader, AuthLayout, AccountMenu, TrustBadge, Logo,
              AuthDivider, UseMyLocationButton, StatusPrimitives (StatusPill/EmptyState),
              SectionNav, DeveloperNavigationMenu
  property/   PropertyDiscovery.tsx (filterProperties, PropertyList, FiltersButton —
              the canonical search/filter/card building blocks, see below),
              HomeDiscovery.tsx, HomeSearch.tsx, DetailPageSearch.tsx,
              RelatedProperties.tsx, ContributionStatusCards.tsx, PropertyMap.tsx,
              WishlistButton.tsx, ContactContributor.tsx, ReviewCard.tsx, ReviewSection.tsx
  add-property/  PropertyForm, RoleSelector, PropertyAttributeFields, ContactPreferenceFields
  account/    AccountSectionNav (now built on shared/SectionNav), AccountPrimitives,
              ProfileForm, PropertyEditForm, PendingSubmissionActions
  admin/      AdminSectionNav (built on shared/SectionNav), PropertyModerationActions,
              VerificationModerationActions — see product-boundaries.md for the
              contradiction this raises against CLAUDE.md §7
  review/     ReviewForm, VerifyStayForm, StarRating
  login/      LoginForm, SignupForm
  home/       ListYourPropertySection
```

New feature-specific components go under their own folder, matching this table. New genuinely reusable primitives go in `shared/`.

`SearchBar.tsx` and `CitySelector.tsx` remain at the top level of `components/` rather than `shared/`, despite being reused across pages — this is documented as an unresolved Current Working Assumption in CLAUDE.md §9/§13, not a mistake to fix opportunistically.

## One search implementation, one destination (CLAUDE.md §20)

`filterProperties()`, `HomeSearch`, and `FiltersButton`/`PropertyList` (all in or around `PropertyDiscovery.tsx`) are the **only** search, filter, and result-card building blocks in the app. The homepage, `/property`, and `DetailPageSearch` (Property Detail's "Continue Exploring" widget) all compose these three rather than each implementing their own. **Never add a second filter/search/card component** — extend these instead. Any search that isn't an in-place filter (i.e. anything other than the homepage's own map+list) should resolve to `/property` via URL query params.

## Shared nav/status primitives now cross account and admin

`components/shared/SectionNav.tsx` and `components/shared/StatusPrimitives.tsx` were written for `/account` and then **generalized in place** (not duplicated) when `/admin` needed the same pill-nav and status-badge/empty-state pattern. If you're building a third "list of my things" surface, extend these rather than writing a fourth badge system — the existing code comments call out that a moderation queue badging status differently from the contributor's own view would itself be a bug.

## Reuse check before writing markup

Before hand-rolling a `<button>`, a `<select>`, or a status pill, check whether `shared/Button.tsx`, `shared/SelectField.tsx` (mirrors `InputField.tsx`), or `shared/StatusPrimitives.tsx` already covers it. Not every new component does this consistently today — `WishlistButton.tsx` and `ContactContributor.tsx` build their own inline button markup rather than importing `shared/Button` — treat that as an existing gap to avoid repeating, not a pattern to follow.
