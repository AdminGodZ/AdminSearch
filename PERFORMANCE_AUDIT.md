# AdminSearch Remaining Performance Work

> Current, intentionally reduced backlog. Resolved findings and rejected micro-optimizations are omitted so this document contains only work that still justifies implementation.

## Current state

| Field | Value |
| --- | --- |
| Reassessment date | 2026-08-02 |
| Source revision | PERF-12 implementation based on `ea99d94` (`master`) |
| Framework | Next.js 16.2.12, React 19.2.6 |
| Runtime | Self-hosted Node.js, SearXNG, Valkey, and Caddy |
| Production telemetry | Not currently available |
| Active findings | 2 |

PERF-01 through PERF-10, PERF-12, and PERF-14 through PERF-16 are implemented and verified. Their implementation history remains in Git; it is no longer repeated here.

### Status legend

- `LATER`: Valid improvement, but current impact does not justify prioritizing it without new production evidence.

## Current measurement snapshot

The 2026-08-02 PERF-12 production build passed TypeScript and `next build`. These are controlled local measurements, not production p50, p95, or p99 claims.

### Route entry JavaScript

| Route | Raw | Offline gzip estimate |
| --- | ---: | ---: |
| `/` | 294,891 bytes | 93,154 bytes |
| `/privacy` | 261,243 bytes | 80,617 bytes |
| `/search` | 382,564 bytes | 115,497 bytes |
| `/settings` | 322,228 bytes | 97,135 bytes |
| `/_not-found` | 192,652 bytes | 57,950 bytes |

PERF-12 intentionally targeted serialized messages rather than the `next-intl` runtime, so no JavaScript reduction is claimed.

### Server-rendered payload after PERF-12

| Route | English HTML | HTML saved | English RSC | RSC saved |
| --- | ---: | ---: | ---: | ---: |
| `/` | 31,923 bytes | 11,317 bytes (26.2%) | 14,306 bytes | 10,478 bytes (42.3%) |
| `/privacy` | 31,257 bytes | 11,942 bytes (27.6%) | 15,070 bytes | 11,048 bytes (42.3%) |
| `/search` | 50,818 bytes | 8,825 bytes (14.8%) | 15,976 bytes | 8,277 bytes (34.1%) |
| `/settings` | 58,943 bytes | 5,298 bytes (8.2%) | 19,322 bytes | 4,998 bytes (20.6%) |

The equivalent German samples saved 6,014-13,211 HTML bytes and 5,714-12,317 RSC bytes. The locale files remain 14,259 bytes for English and 15,639 bytes for German, but each client boundary now receives only the global labels and route-specific namespaces it uses. Server-only `Privacy` and `ApiErrors` messages are not serialized into client providers.

Docker was not running during this reassessment, so Redis round-trip and SearXNG engine conclusions are based on the deployed topology and code paths rather than a live-container sample.

## Recommended order

| Order | ID | Priority | Status | Outcome |
| ---: | --- | --- | --- | --- |
| 1 | PERF-11 | P3 | LATER | Parse preferences once per server render; do not pursue the former static-route redesign. |
| 2 | PERF-13 | P3 | LATER | Make the Redis counter atomic if reliability or measured Redis time justifies it. |

## PERF-11: Memoize preference parsing per server render

- **Priority:** P3
- **Status:** LATER
- **Evidence:** [`src/features/settings/server/preferences.ts`](src/features/settings/server/preferences.ts), [`src/app/layout.tsx`](src/app/layout.tsx), [`src/app/page.tsx`](src/app/page.tsx), [`src/app/search/page.tsx`](src/app/search/page.tsx), [`src/app/settings/page.tsx`](src/app/settings/page.tsx)

### Current problem

The root layout, next-intl request configuration, and several pages can call `getPersistedPreferences` during the same server render. The helper is not memoized, so it can read and parse the same cookie more than once.

The former PERF-11 proposal to split cookies and make privacy static is no longer active. The controlled privacy response was already small and fast locally, while restructuring root locale and theme ownership creates a real risk of theme flash, locale mismatch, and settings divergence.

### Implementation scope

- Memoize `getPersistedPreferences` at the request/server-render boundary using the framework-supported request cache pattern.
- Keep the cookie format, size, path, persistence behavior, and all preference ownership unchanged.
- Do not introduce static route groups, client-only theme bootstrapping, or a second preference source.

### Acceptance criteria

- [ ] Repeated calls in one server render resolve to one cookie read and parse.
- [ ] Separate requests never share user preference data.
- [ ] Theme, color theme, locale, search defaults, and settings remain unchanged.
- [ ] No theme flash or hydration mismatch is introduced.

### Required validation

- Unit-test same-request deduplication and cross-request isolation.
- Browser-test direct loads and navigation in light, dark, system, English, and German states.
- Treat this as a small server-work cleanup, not a cacheability project.

## PERF-13: Make the Redis limiter atomic

- **Priority:** P3
- **Status:** LATER
- **Evidence:** [`src/server/rate-limit.ts`](src/server/rate-limit.ts), [`src/server/redis.ts`](src/server/redis.ts)

### Current problem

The Redis-backed limiter performs `INCR`, conditional `PEXPIRE`, and `PTTL`. New keys use three round trips and can theoretically remain without expiry if the process stops after incrementing but before setting the TTL.

Valkey is currently local to the application stack, so latency improvement is expected to be small. The stronger reason to implement this item is atomic expiry correctness, or evidence from PERF-14 that rate limiting is material.

### Implementation scope

- Use one portable atomic Redis script to increment, set the first expiry, and return the count and remaining TTL.
- Prefer `EVALSHA` with a safe script-reload fallback if that does not complicate outage handling.
- Preserve the bounded in-memory fallback and all existing rate-limit headers.
- Do not change limits, windows, client-IP derivation, or failure policy.

### Acceptance criteria

- [ ] A Redis-backed check requires one round trip in the normal path.
- [ ] A counter can never be created without an expiry.
- [ ] Remaining counts, reset timestamps, and headers retain current semantics.
- [ ] Redis errors still fall back safely to the bounded memory limiter.

### Required validation

- Test first increment, later increments, expiry, concurrent increments, script-cache loss, and Redis failure.
- Compare rate-limit phase timing before and after using PERF-14 instrumentation.
- Do not claim user-visible improvement unless the measured phase is material.

## Removed from the active backlog

The following findings should not be reopened without new measurements or changed requirements:

- **PERF-17:** IntersectionObserver already performs the primary infinite-scroll detection. The extra check is animation-frame throttled, cleaned up, and useful as a reliability fallback; removing it has low upside and regression risk.
- **PERF-18:** The settings route is 97,135 bytes gzip, only about 4 KiB above home, and renders only the active settings section. Splitting the 1,262-line component may improve maintainability, but it is not justified as a performance project.
- **PERF-19:** Result memoization already removed the important repeated work. Hoisting tiny sets, caching a short environment split, or replacing a one-second text animation is not expected to affect user-visible performance.
- **PERF-20:** Image pull policy, restart speed, and SearXNG engine/time-out tuning are operations decisions. Engine tuning requires production latency and result-quality data; SearXNG already suspends CAPTCHA-failing engines.
- **Full former PERF-11:** Cookie splitting and static privacy rendering are deferred indefinitely unless production capacity or cacheability data shows a real need.

## Validation standard for every implementation

- Work in an isolated Git worktree and keep changes limited to one finding.
- Preserve the current UI, copy, layout, interaction model, accessibility, privacy behavior, and settings semantics unless the item explicitly says otherwise.
- Run focused unit tests, the full test suite, TypeScript, targeted Biome checks, the production build, and changed-scope React Doctor.
- Use production-browser verification for any client, navigation, media, theme, locale, or timing change.
- Compare before and after using the same measurement method.
- Label local samples as controlled samples; do not present them as production percentiles.
