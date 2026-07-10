# Typewise

Typewise is a generation-aware Pokémon team weakness analyzer. Pick a ruleset,
search an illustrated legal Pokédex, assign up to four learnable moves to each
of six team members, and get an explainable report of defensive pressure,
offensive blind spots, moveset gaps, and likely breaker archetypes.

**Live:** [typewise-indol.vercel.app](https://typewise-indol.vercel.app)

**Source:** [github.com/fireboltdude1357/typewise](https://github.com/fireboltdude1357/typewise)

## Product behavior

- Generation-first flow covering Generations I–IX.
- A default National roster plus an optional core-game roster for each generation.
- Searchable and type-filterable Pokémon/form catalog with sprites.
- Searchable move picker with type, category, and learn-method filters.
- Historical move power, category, accuracy, typing, and type charts.
- Exact dual-type defensive multipliers, including 0×, 0.25×, and 4×.
- Shared weakness and safe-switch counts for every attacking type.
- Damaging-move-only offensive coverage and STAB gap detection.
- Ranked offensive and defensive breaker archetypes with explanations.
- Anonymous local drafts and Clerk-authenticated Convex cloud saves.
- Responsive desktop/mobile UI, including a mobile quick-team dock.

## Generation and legality semantics

The selector represents a **generation ruleset**, not a single cartridge. The
roster selector then chooses one of two explicitly different catalogs:

- **All Pokémon** is the default National scope. It includes every official
  species and mechanically distinct form introduced by the selected generation,
  even when that entry is not usable in a core title from that generation.
- **Core games** is the union of the generation's canonical competitive roster
  and every supported core-title roster. That adds Let's Go, Pikachu! / Let's
  Go, Eevee! in Gen VII; Brilliant Diamond / Shining Pearl and Legends: Arceus
  in Gen VIII; and Legends: Z-A in Gen IX. The default National scope also
  includes Pokémon Champions move availability without labeling that
  battle-focused title as a core RPG.

Changing scope clears an existing lineup after confirmation because both the
available forms and their moves may change. Scope is stored with anonymous local
drafts and authenticated Convex saves, and loading a save restores its scope
before rehydrating the team against the authoritative dex.

Move resolution combines `@pkmn/data`'s generation-aware learn sources with
simulator-derived additions/removals and title-specific pools. Side-title-only
Core entries start from their title pools instead of inheriting an incompatible
National movepool. This preserves inheritance for regional, gender, size, color,
and battle-only forms without leaking base-form moves. Transfer, event,
side-title, Virtual Console, Let's Go transfer, and Sketch sources are labeled
in the picker. Hidden Power is expanded into typed variants for Generations
II–VII; Gen VI/VII availability is restricted by simulator validation of each
species' IV and event constraints.

Title-specific legality supplements are generated into
`src/data/core-game-data.json` by `scripts/generate-core-game-data.mjs`. The
generator uses the pinned `@pkmn/sim` and `@pkmn/mods` packages for Let's Go,
BDSP, Legends: Arceus, and Pokémon Champions. Legends: Z-A data is fetched from
an immutable Pokémon Showdown commit
`d21da3c860f62d2ecd2feec7d910ef56d5054988` and verified against checked-in
SHA-256 hashes before it is transpiled in memory. The generated file also contains
simulator-derived base-movepool deltas, Sketch additions (`K` sources), and
per-species legal Hidden Power types for Generations VI–VII.

The pinned Z-A snapshot still marks Mega Garchomp Z unobtainable, so the
generator applies one narrowly asserted release overlay backed by the
[official Pokémon announcement](https://legends.pokemon.com/en-gb/news/mega-garchomp-z)
that its Mystery Gift became available on 2026-02-27. The
official URL and date are stored in the generated provenance.

Regenerate the asset after intentionally updating one of those pinned sources:

```bash
npm run data:generate
```

The output has no timestamp and is byte-for-byte deterministic. Review source
commit/hash changes and the generated diff together.

The picker proves individual move legality. It does not claim that every
four-move combination is simultaneously obtainable when multiple exclusive
event distributions are involved; those moves remain visibly labeled.

## Architecture

- **Web:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- **Data:** pinned `@pkmn/dex`, `@pkmn/data`, and `@pkmn/img` runtime
  packages, with `@pkmn/mods` and `@pkmn/sim` used only by the development-time
  generator and legality tests.
- **Backend:** Convex schema and authenticated CRUD in `convex/teams.ts`.
- **Authentication:** Clerk v7 with `ConvexProviderWithClerk`.
- **Hosting:** Vercel for the Next.js app and Convex production deployment.
- **Testing:** Vitest for data/analysis and Playwright for desktop/mobile flows.

The dex routes cache generated catalogs and move lists for 24 hours. Convex
derives ownership only from Clerk's signed identity subject; clients never
provide an owner ID. Saved teams are bounded to six unique forms, four unique
moves per member, and fifty teams per account. Each save includes its roster
scope. Saved content is rehydrated against the authoritative dex when loaded,
so unavailable entries and moves are dropped.

## Local setup

Requirements: Node.js 20.9.0+, npm, a Convex account, and a Clerk application.

```bash
npm install
cp .env.example .env.local
npx convex dev
npm run dev
```

The app intentionally runs in a local-only demo mode when Clerk/Convex public
configuration is absent. Cloud controls appear once both public values exist.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `CONVEX_DEPLOYMENT` | local | Convex development deployment selector |
| `NEXT_PUBLIC_CONVEX_URL` | local + Vercel | Browser Convex endpoint |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | local + Vercel | Clerk browser key |
| `CLERK_SECRET_KEY` | local + Vercel | Clerk server key/middleware |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex | Clerk issuer used to validate JWTs |

In Clerk, activate the Convex integration so session tokens receive the
required `aud: "convex"` claim. Then configure the issuer on each Convex
deployment and push the auth configuration:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev
npx convex dev --once
```

Never commit `.env.local` or real key values.

## Quality gates

```bash
npm run lint          # Next/React/TypeScript lint rules
npm run typecheck     # app and Convex TypeScript projects
npm test              # unit and generation-data regression tests
npm run test:coverage
npm run build         # optimized production build
npm run test:e2e      # Chromium desktop + Pixel 7 flows
npm run check         # lint + types + units + build
```

The E2E suite covers generation onboarding, National/core scope switching,
side-title roster representatives, full-catalog search, team creation, move
selection, live analysis, local-draft reload, and generation cleanup on desktop
and mobile. Set `PLAYWRIGHT_BASE_URL` to test an existing deployment.
The credential-gated cloud test additionally signs in and proves the Convex
save/reload/delete round trip when `E2E_CLERK_EMAIL` and
`E2E_CLERK_PASSWORD` are provided. Use a disposable, least-privileged test
account; browser traces are disabled whenever those credentials are present.

## Deployment

The intended CLI flow is:

```bash
npx convex deploy
vercel link
vercel env add NEXT_PUBLIC_CONVEX_URL production
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production
vercel deploy --prod
```

Production is complete only after the Convex production issuer is set, Clerk's
allowed origins/redirects include the Vercel domain, and an authenticated
save/reload/delete smoke test passes at the live URL.

The Vercel deployment and Convex production backend are live, and the
authenticated cloud round trip has been verified. This friends-only
development/testing deployment intentionally uses Clerk's development instance.
It is not presented as a production Clerk environment; a future public release
would require a user-owned domain/DNS, live Clerk keys, production OAuth
configuration, and a matching Convex issuer.

## Analysis limits

Typewise is a team-building aid, not a battle simulator. The current report is
type and selected-move based. Abilities, held items, stats, EVs, natures,
weather, Terastallization, move order, and format clauses can change real
matchups; the UI states this beside every report.

## Data and trademarks

Data tooling is derived from Pokémon Showdown and distributed under the MIT
license. The image loader first uses Pokémon Showdown's public sprite service,
then tries the nearest visual/base form and the public
[PokéAPI sprite repository](https://github.com/PokeAPI/sprites) when a form
sprite is unavailable. Pokémon and all related names are trademarks of Nintendo,
Game Freak, and The Pokémon Company. This project is not affiliated with or
endorsed by them. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for
the preserved upstream license notice and generated-data provenance.
