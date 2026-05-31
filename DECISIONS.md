# Decisions

- 2026-05-30: `create-next-app` could not run in this folder because npm package names cannot contain uppercase letters; scaffolded the same Next.js App Router setup manually.
- 2026-05-30: Staff login accepts an optional `restaurantSlug`; if omitted and the email exists in more than one restaurant, the API returns an ambiguity error.
- 2026-05-30: Cross-zone seating combos are allowed; when a diner filters by zone, a combo is considered eligible if it contains at least one mesa from that zone.
- 2026-05-30: Passwordless diner magic links use signed stateless tokens for the MVP instead of a token table, keeping secrets in `AUTH_SECRET`.
- 2026-05-30: pg-boss is wired behind `ENABLE_PG_BOSS`; notification rows remain the source of truth and can be processed by the local worker or `/api/v1/jobs/notifications`.
- 2026-05-31: The product visual direction is editorial hospitality: Fraunces for display, Manrope for UI/body, warm paper neutrals, one restaurant-driven accent token, and Phosphor as the single icon set.
- 2026-05-31: Dark mode is token-driven via `prefers-color-scheme` first; a manual theme switch can be added later without rewriting components.
- 2026-05-31: Cookie `secure` follows `AUTH_COOKIE_SECURE` or `APP_URL`; Docker local uses HTTP, so staff and diner sessions must not be marked secure there.
- 2026-05-31: Self-serve onboarding creates all-week rolling shifts by default; it favors getting a small restaurant live quickly, with precise day exceptions handled later in configuration.
