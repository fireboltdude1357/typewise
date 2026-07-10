# Typewise

Typewise is a generation-aware Pokémon team weakness analyzer. Pick a ruleset,
search an illustrated legal Pokédex, assign up to four learnable moves to each
of six team members, and get an explainable report of defensive pressure,
offensive blind spots, moveset gaps, and likely breaker archetypes.

## Product behavior

- Generation-first flow covering Generations I–IX.
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
catalog follows Pokémon Showdown's standard competitive dex for the primary
paired titles in that generation. Learn sources that are legal in the selected
generation are combined, and transfer/event-only availability is labeled.
Side-game-only dexes such as Let's Go, BDSP, and Legends: Arceus are not merged
into the Gen VII/VIII competitive catalog.

Move resolution uses `@pkmn/data`'s generation-aware `learnable()` API. This is
important for regional, gender, size, color, and battle-only forms: it inherits
moves where the games do, without leaking the base form's incompatible moves.
Hidden Power is expanded into its legal typed variants for Generations II–VII.

The picker proves individual move legality. It does not claim that every
four-move combination is simultaneously obtainable when multiple exclusive
event distributions are involved; those moves remain visibly labeled.

## Architecture

- **Web:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- **Data:** pinned `@pkmn/dex`, `@pkmn/data`, and `@pkmn/img` packages.
- **Backend:** Convex schema and authenticated CRUD in `convex/teams.ts`.
- **Authentication:** Clerk v7 with `ConvexProviderWithClerk`.
- **Hosting:** Vercel for the Next.js app and Convex production deployment.
- **Testing:** Vitest for data/analysis and Playwright for desktop/mobile flows.

The dex routes cache generated catalogs and move lists for 24 hours. Convex
derives ownership only from Clerk's signed identity subject; clients never
provide an owner ID. Saved teams are bounded to six unique forms, four unique
moves per member, and fifty teams per account. Saved content is rehydrated
against the authoritative dex when loaded, so unavailable entries are dropped.

## Local setup

Requirements: Node.js 20+, npm, a Convex account, and a Clerk application.

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

In Clerk, enable the Convex integration/JWT template. Then configure the issuer
on each Convex deployment and push the auth configuration:

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

The E2E suite covers generation onboarding, full-catalog search, team creation,
move selection, live analysis, local-draft reload, and generation cleanup on
desktop and mobile.

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

## Analysis limits

Typewise is a team-building aid, not a battle simulator. The current report is
type and selected-move based. Abilities, held items, stats, EVs, natures,
weather, Terastallization, move order, and format clauses can change real
matchups; the UI states this beside every report.

## Data and trademarks

Data tooling is derived from Pokémon Showdown and distributed under the MIT
license. Sprites are displayed from Pokémon Showdown's public sprite service.
Pokémon and all related names are trademarks of Nintendo, Game Freak, and The
Pokémon Company. This project is not affiliated with or endorsed by them.
