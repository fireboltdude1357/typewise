# Typewise completion review

Review date: 2026-07-10

This document records the final completeness review for the generation-aware
catalog, move legality, analysis, persistence, and deployment work. It is meant
to survive the implementation session: release evidence should be added here
when a final commit or deployment changes.

## Acceptance interpretation

- A generation is a ruleset, not one cartridge.
- **All Pokémon** is the default National scope: every official species and
  mechanically distinct form introduced through that generation, excluding
  custom, CAP, cosmetic-only, and unobtainable records.
- **Core games** is the union of the canonical competitive roster and the
  supported title rosters for that generation. Supplements cover Let's Go in
  Gen VII, BDSP and Legends: Arceus in Gen VIII, and Legends: Z-A in Gen IX.
  The National move union additionally includes the
  battle-focused Pokémon Champions roster and learnsets.
- "All legal moves" means each displayed move has at least one legal source for
  that Pokémon/form in the selected generation and scope. It does not promise
  that four independently legal moves from mutually exclusive events can occur
  on one set.
- Breakers are type-level offensive and defensive pressure archetypes. Typewise
  does not simulate abilities, items, stats, EVs, weather, Terastallization, or
  format clauses.

## Findings and dispositions

| Area | Audit finding | Disposition | Status |
| --- | --- | --- | --- |
| Catalog coverage | The original standard-dex filter omitted Let's Go, BDSP, PLA, Z-A, Champions, and official nonstandard forms. | Add persisted `national` and `core` scopes. National is the default; Core unions canonical and generated core-title rosters. National additionally consumes Champions learnsets. | Exact National/Core entry and National-number counts pass for all nine generations. |
| Scope UX | A roster change can invalidate both members and moves. | Confirm when a nonempty team changes scope, clear incompatible state, include scope in API requests and cache keys, and show the active scope's provenance note. | Desktop/mobile Chrome flows pass, including scope persistence and title representatives. |
| Save fidelity | The original local/cloud payload did not identify roster semantics. | Persist scope in local drafts and Convex records; restore it before authoritative catalog/move rehydration. Legacy local drafts fall back to National. | Deployed with optional/default-National rollout compatibility; live scope-aware cloud round trip passed. |
| Title provenance | Side-title data was not available from one runtime package and could drift if fetched at build time. | Check in deterministic `core-game-data.json`; pin `@pkmn/mods`/`@pkmn/sim` 0.10.11 and the Z-A Showdown commit plus per-file SHA-256 hashes. Runtime code does not ship the simulator. | Generated asset present and source-pinned. |
| Move completeness | `@pkmn/data.learnable()` alone produced form-specific false positives and negatives. Examples included Kyurem-B/W, Gourgeist sizes, Necrozma-Ultra, Greninja-Bond, Vivillon forms, Raichu-Alola, and Ursaluna-Bloodmoon. | Validate the permissive/simulator candidate union move-by-move with `TeamValidator.checkCanLearn`, then apply additions/removals and merge validator-filtered title learnsets. | 462,954 candidates compared with zero generated mismatches; runtime regressions pass. |
| Sketch | Inherited learnsets did not represent Smeargle's legal Sketch pool. | Generate exact simulator move pools and mark source-less simulator additions with synthetic `K`/Sketch provenance. Respect `nosketch`, Z-Move, Max Move, and generation constraints. | Exact Gen II/III/IX regressions and Revival Blessing exclusion pass. |
| Hidden Power | Expanding every historical type ignored IV/event restrictions, including impossible Hidden Power Fighting on Gen VI/VII Xerneas and Gen VII Magearna. | Precompute per-species Gen VI/VII variants with `TeamValidator`; retain generation-appropriate typed variants in earlier generations. | Xerneas, Magearna, Greninja-Bond, and ordinary-species regressions pass. |
| Historical typeless moves | Gen I Bide and Gen II–IV Curse could reach analysis with the historical `???` type and throw because it is absent from the visible type chart. | Permit unknown types only for status or type-independent matchup modes and retain strict checks for ordinary damaging moves. | Resolved with a unit regression. |
| Move mechanics | Fixed/fractional/OHKO damage, immunity behavior, Freeze-Dry, Thousand Arrows, Flying Press, and form-dependent move typing require special handling. | Keep explicit matchup modes and effectiveness overrides, covered by analysis/data tests. | Current analysis/data regressions pass. |
| Images | Fourteen catalog forms had Showdown sprite URLs that returned 404. | Retry nearest visual form, base-species Showdown sprite, then PokéAPI official art and base sprite. Retry state is keyed by failed URL. | All 1,379 live Gen IX National entries have a successful primary or fallback URL; 61 currently use a fallback. |
| Route caching | Reusing the original 24-hour cache keys allowed old and new response schemas to coexist after deployment. | Version both catalog and move-list cache keys whenever their schemas or semantics change. | Versioned caches are live; smoke responses uniformly expose `matchupMode` and no legacy field. |
| Analysis output | Weaknesses, gaps, and breakers must be explainable rather than opaque scores. | Preserve exact dual-type multipliers, safe-switch/shared-weakness counts, selected damaging-move coverage, STAB gaps, and ranked type-level breaker explanations. | Current unit and desktop/mobile browser coverage passes. |
| Convex trust boundary | Ownership, size, uniqueness, and count limits are server-enforced, but Convex does not independently replay dex legality for submitted IDs. | Continue signed-subject ownership and bounded payload validation; rehydrate against the authoritative dex on load. Treat server-side dex validation as future hardening, not a claim made by the product. | Accepted residual risk, documented here. |
| Multi-move compatibility | Individually legal event moves can be mutually exclusive on one four-move set. | Label event/transfer provenance and explicitly avoid claiming joint source compatibility. | Accepted product limitation, disclosed in UI/README. |
| Dependency audit | `npm audit --omit=dev` reports two moderate PostCSS advisories nested under Next.js; npm's suggested force fix is an invalid downgrade to Next 9.3.3. | Do not apply a breaking downgrade. The app does not stringify user-controlled CSS; monitor for a compatible patched Next.js release. | Accepted low-impact residual risk; no high or critical advisories. |
| Clerk environment | The live authenticated round trip uses a Clerk development instance. True Clerk production would require a user-owned domain/DNS and production OAuth decisions. | The user explicitly chose a friends-only development/testing deployment on 2026-07-10. Keep the verified development integration and do not claim a production Clerk environment. | Accepted deployment scope; no release blocker. |

## Generated-data evidence

The current schema-v1 asset is generated by
`scripts/generate-core-game-data.mjs`. It contains no timestamp. At review time
its SHA-256 is
`a77e18ac73509536076dc10bc4c567c5e939b819e451fd815ae8d2c41f2775a7`.

| Supplement | Form entries | National numbers | Direct moves | Synthetic moves |
| --- | ---: | ---: | ---: | ---: |
| Let's Go, Pikachu! / Let's Go, Eevee! | 188 | 153 | 5,249 | 0 |
| Sword / Shield — Gigantamax forms | 34 | 32 | 2,590 | 0 |
| Brilliant Diamond / Shining Pearl | 526 | 493 | 27,251 | 509 |
| Pokémon Legends: Arceus | 279 | 242 | 5,605 | 0 |
| Pokémon Legends: Z-A | 514 | 364 | 21,015 | 0 |
| Pokémon Champions | 314 | 208 | 19,526 | 0 |

The generator also compares every National candidate against the simulator's
transfer-aware pool for Generations I–IX, records only additions/removals, and
stores validated Hidden Power maps for Generations VI–VII. Its invariants cover
the title counts and representative Meltan, Unown, Ursaluna, Raichu-Mega-X,
Smeargle, Xerneas, and Magearna cases.

## Verification record

Stable baseline commit `be466e9` had a clean CI pipeline, 35 passing Vitest
tests, successful desktop/mobile Chromium flows, and two authenticated
Clerk→Convex production create/list/load/delete round trips corroborated by
production logs. Those results predate the National/core expansion and are not
a substitute for the final rerun.

| Gate | Most recent evidence | Release state |
| --- | --- | --- |
| Generator determinism and pinned-source hashes | Generator ran byte-identically again on 2026-07-10; all four pinned Z-A hashes, source-array checks, generator ESLint, and invariants passed. Current hash and title counts are recorded above. | Green. |
| ESLint for E2E changes | `npx eslint tests/e2e/team-builder.spec.ts` passed on 2026-07-10. | Green. |
| `npm run check` | Passed on 2026-07-10: ESLint, app/Convex TypeScript, 46 Vitest tests, and optimized Next.js build. | Green. |
| `npm run test:e2e` | Windows system Chrome passed 6/6 applicable desktop/mobile flows locally and against the live Vercel URL on 2026-07-10. | Green. |
| Exact catalog and move regressions | National/Core counts, title forms, validator deltas, Sketch, Hidden Power, and exhaustive nonempty/unique move lists pass. | Green. |
| Convex development + production schema/functions | Compatibility-first schema/functions deployed to `kindred-falcon-240` and production `rare-pony-381`; both accepted the rollout. | Green. |
| Vercel production smoke | Deployment `dpl_6efi9oceHpAXWa8xCHLsxgU1jJxQ` is Ready and aliased at `https://typewise-indol.vercel.app`; exact catalog counts, representative move pools, invalid input, and fresh schemas passed. | Green. |
| Authenticated live save/reload/delete | A disposable Clerk development user completed list/create/reload/remove on the live UI at 10:57 CDT; Convex logs corroborate it, cleanup left no user or saved document, and device trust was restored. | Green for the user-approved development/testing scope. |
| Git review | Three logical feature/data/docs commits through `383c1df` are pushed; independent final diff/security reviews are clean. GitHub CI run `29104919518` passed both quality and browser jobs. | Green. |

## Release handoff checklist

- [x] Regenerate the asset in the final tree and confirm its deterministic hash.
- [x] Run lint, typecheck, unit tests, and the production build.
- [x] Run Playwright desktop and mobile locally, then against the Vercel URL.
- [x] Verify exact catalog counts, representative title forms, form-specific
      legality deltas, Sketch exclusions, and Hidden Power restrictions.
- [x] Verify every catalog entry has at least one successful image candidate
      locally and against the deployed API.
- [x] Deploy Convex development and production schema/functions.
- [x] Deploy Vercel; smoke both scope-aware API routes and rule out stale cache
      schemas.
- [x] Repeat authenticated create/list/load/delete with a scope-aware team.
- [x] Commit in reviewable units, push, confirm CI, and record commit/deployment
      identifiers in this file.
- [x] Record the user's decision to keep Clerk in development mode for this
      friends-only testing deployment.
