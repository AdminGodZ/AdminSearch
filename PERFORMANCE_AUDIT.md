# AdminSearch Remaining Performance Work

> Current, intentionally reduced backlog. Resolved findings and rejected micro-optimizations are omitted so this document contains only work that still justifies implementation.

## Current state

| Field | Value |
| --- | --- |
| Reassessment date | 2026-08-02 |
| Source revision | PERF-14 worktree based on `e68e051` (`master`) |
| Framework | Next.js 16.2.12, React 19.2.6 |
| Runtime | Self-hosted Node.js, SearXNG, Valkey, and Caddy |
| Production telemetry | Not currently available |
| Active findings | 4 |

PERF-01 through PERF-10, PERF-14, and PERF-16 are implemented and verified. Their implementation history remains in Git; it is no longer repeated here.

### Status legend

- `READY`: Bounded implementation is worthwhile now.
- `LATER`: Valid improvement, but current impact does not justify doing it before the ready items.

## Current measurement snapshot

The 2026-08-02 production build passed TypeScript and `next build`. The size snapshot below was measured on 2026-08-01; these are controlled local measurements, not production p50, p95, or p99 claims.

### Route entry JavaScript

| Route | Raw | Offline gzip estimate |
| --- | ---: | ---: |
| `/` | 294,100 bytes | 92,856 bytes |
| `/privacy` | 260,756 bytes | 80,432 bytes |
| `/search` | 383,279 bytes | 115,669 bytes |
| `/settings` | 321,441 bytes | 96,815 bytes |
| `/_not-found` | 192,560 bytes | 57,924 bytes |

### Server-rendered HTML

| Route | HTML bytes |
| --- | ---: |
| `/` | 43,239 |
| `/privacy` | 43,199 |
| `/search` | 59,643 |
| `/settings` | 64,242 |

The locale files remain 14,259 bytes for English and 15,639 bytes for German. Their largest namespaces are `Settings`, `Privacy`, and `Search`; client labels required on every route total only about 1 KiB.

Docker was not running during this reassessment, so Redis round-trip and SearXNG engine conclusions are based on the deployed topology and code paths rather than a live-container sample.

## Recommended order

| Order | ID | Priority | Status | Outcome |
| ---: | --- | --- | --- | --- |
| 1 | PERF-15 | P2 | READY | Remove inline player loads and make video thumbnails direct links. |
| 2 | PERF-12 | P2 | READY | Serialize only the translation namespaces required by each route or interactive subtree. |
| 3 | PERF-11 | P3 | LATER | Parse preferences once per server render; do not pursue the former static-route redesign. |
| 4 | PERF-13 | P3 | LATER | Make the Redis counter atomic if reliability or measured Redis time justifies it. |

## PERF-15: Keep video results thumbnail-only

- **Priority:** P2
- **Status:** READY
- **Evidence:** [`src/features/search/components/video-result-card.tsx`](src/features/search/components/video-result-card.tsx)

### Current problem

Moving the pointer across a video thumbnail immediately replaces the lazy thumbnail with a third-party iframe. Hovering or focusing several results can initialize multiple players, creating avoidable third-party connections, JavaScript execution, media requests, CPU work, and memory use before the user has chosen a video.

Inline previews are not required. The thumbnail can serve as a normal link to the original video, matching the intentional navigation already available from the result.

### Implementation scope

- Remove the inline player iframe and all hover, focus, blur, timer, and preview state used only to mount it.
- Keep the existing lazy-loaded thumbnail visible at all times.
- Make the thumbnail a normal link to the exact original video URL, using the same safe external-link behavior as the result's existing video link.
- Preserve modifier-click, context-menu, and keyboard activation semantics.
- Preserve the card layout, thumbnail sizing and crop, metadata, visible styling, and focus indication.
- Do not add click-to-play, a modal, an embedded player, preconnects, or player prefetching.
- This item intentionally removes hover and keyboard-focus previews in favor of direct, explicit navigation.

### Acceptance criteria

- [ ] No video-player iframe is rendered or mounted on initial render, hover, focus, blur, or pointer movement.
- [ ] Hovering or focusing video results creates no player-script, player-document, or media requests.
- [ ] Clicking the thumbnail or activating it from the keyboard opens the exact original video URL with the established external-link semantics.
- [ ] Modifier-click and the browser context menu continue to work because the thumbnail is a real anchor.
- [ ] Card layout, thumbnail rendering, metadata, responsive behavior, and visible focus treatment remain unchanged.

### Required validation

- Add component coverage proving hover and focus never create an iframe and verifying the thumbnail link's URL, target, and `rel` attributes.
- In a production browser, confirm repeated hover and keyboard focus produce zero player iframe or media requests.
- Verify pointer click, Enter activation, modifier-click semantics, and context-menu availability without changing the destination.
- Compare video cards in light and dark themes at desktop and narrow widths to confirm the visible layout is unchanged.

## PERF-12: Scope client translation messages

- **Priority:** P2
- **Status:** READY
- **Evidence:** [`src/app/layout.tsx`](src/app/layout.tsx), [`src/i18n/request.ts`](src/i18n/request.ts), [`messages/en.json`](messages/en.json), [`messages/de.json`](messages/de.json)

### Current problem

The root `NextIntlClientProvider` inherits the complete locale object on every route. That serializes 14-16 KiB of raw messages even when a route needs only global header/footer labels and a small route-specific subset.

Current namespace sizes show a bounded opportunity:

| Namespace | English | German | Main consumer |
| --- | ---: | ---: | --- |
| `Settings` | 5,691 bytes | 6,244 bytes | `/settings` |
| `Privacy` | 2,249 bytes | 2,593 bytes | Server-rendered privacy page |
| `Search` | 1,874 bytes | 2,135 bytes | `/search` |
| Global client labels combined | About 1 KiB | About 1 KiB | Header and footer |

The ICU runtime will remain while client components use `useTranslations`; this item targets serialized messages, not a promised JavaScript-runtime removal.

### Implementation scope

- Pass only global interactive namespaces at the root client boundary.
- Add route or subtree providers for home, search, and settings client namespaces.
- Keep server-only namespaces such as `Privacy` and `ApiErrors` out of client serialization.
- Avoid a broad rewrite that converts every translated component to string props.
- Preserve runtime locale switching and the current English/German output exactly.

### Acceptance criteria

- [ ] `/privacy` does not serialize `Settings`, `Search`, `Privacy`, or `ApiErrors` into the client provider.
- [ ] Home, search, and settings receive only their required client namespaces plus global labels.
- [ ] No missing-message errors occur during direct loads, client navigation, interaction, or locale switching.
- [ ] English and German visible text remains unchanged.
- [ ] HTML/RSC payload decreases measurably; no JavaScript reduction is claimed unless measured.

### Required validation

- Add namespace-coverage tests for every route-level client subtree.
- Compare route HTML/RSC bytes before and after using the same production build method.
- Browser-test direct loads, cross-route navigation, language changes, search interactions, settings sections, and error states in both locales.

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
- **PERF-18:** The settings route is 96,815 bytes gzip, only about 4 KiB above home, and renders only the active settings section. Splitting the 1,262-line component may improve maintainability, but it is not justified as a performance project.
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
