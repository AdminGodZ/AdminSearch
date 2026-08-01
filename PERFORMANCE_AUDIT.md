# AdminSearch Performance and Latency Audit

> Living implementation tracker for performance, speed, scalability, and latency work.

## Audit metadata

| Field | Value |
| --- | --- |
| Audit date | 2026-07-31 |
| Application | AdminSearch |
| Framework | Next.js 16.2.12, React 19.2.6 |
| Runtime | Node.js, Docker Compose, Caddy, SearXNG, Valkey |
| Audit type | Read-only code, build-artifact, bundle, and live local-stack analysis |
| Source state during audit | Clean worktree; no source changes made by the audit |
| React Doctor baseline | 100/100, no issues found before this audit |
| Production telemetry available | No; local measurements and static code-path evidence only |

## Status legend

- `OPEN`: Valid finding that has not been implemented.
- `IN PROGRESS`: Implementation is underway.
- `BLOCKED`: A documented dependency or decision prevents progress.
- `VALIDATE`: Implemented but awaiting the stated measurements or tests.
- `DONE`: Implemented and verified against the acceptance criteria.
- `WON'T DO`: Deliberately rejected with a documented reason.
- `CONFIRMED HEALTHY`: Reviewed and not considered a performance problem.

## Executive summary

The dominant performance bottleneck is repeated, sequential SearXNG work. The current pagination design can re-fetch every previous upstream page, while the first search does not begin until the browser has downloaded and hydrated the search client.

Recommended implementation order:

1. Replace restart-from-page-one pagination with continuation state.
2. Start the initial search before client hydration and avoid full-document search navigation.
3. Propagate cancellation to SearXNG and debounce/deduplicate autocomplete.
4. Remove unnecessary synchronous client storage and unconditional calculator loading.
5. Optimize long-list rendering, favicons, shared JavaScript, and static rendering.

The warmed Next.js layer is already fast locally. Search latency is dominated by upstream work, so backend-request improvements should precede UI micro-optimizations.

## Priority tracker

| ID | Priority | Finding | Expected impact | Effort | Confidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PERF-01 | P0 | Pagination re-fetches previous upstream pages | Very high search/load-more latency and backend load | Medium-high | High | DONE |
| PERF-02 | P0 | Initial search starts after hydration and native form reload | High time-to-first-result improvement | Medium | High | DONE |
| PERF-03 | P0 | Browser aborts do not cancel upstream work | High capacity and tail-latency improvement | Low-medium | High | DONE |
| PERF-04 | P0 | Autocomplete has zero debounce and fetches while unfocused | High request-volume reduction | Low | High | DONE |
| PERF-05 | P1 | Fresh-result mode still serializes the full session cache | Medium-high INP/main-thread improvement | Low-medium | High | DONE |
| PERF-06 | P1 | Every non-empty query loads mathjs | Medium download/parse improvement | Low | High | DONE |
| PERF-07 | P1 | Load-more rerenders the accumulated result list | Medium long-session rendering improvement | Low-medium | High | OPEN |
| PERF-08 | P1 | Favicon URLs fail through `next/image` and are not server-cached | Correctness plus medium request-fan-out improvement | Low-medium | High | DONE |
| PERF-09 | P1 | Large global client dependency baseline | Medium cold-load and parse improvement | Medium | High | DONE |
| PERF-10 | P2 | Both theme logos are eagerly preloaded | Medium home-page LCP/network improvement | Low-medium | High | DONE |
| PERF-11 | P2 | Root cookie access makes every route dynamic | Medium cacheability/capacity improvement | Medium-high | High | OPEN |
| PERF-12 | P2 | All translation messages are sent to every client route | Low-medium HTML/hydration improvement | Medium | High | OPEN |
| PERF-13 | P2 | Redis limiter uses two or three round trips | Low locally, medium with remote Redis | Low | High | OPEN |
| PERF-14 | P2 | Search timing omits work and lacks phase telemetry | Enables reliable prioritization and regression detection | Medium | High | OPEN |
| PERF-15 | P2 | Video preview iframe loads on immediate hover/focus | Medium bandwidth/privacy improvement | Low | High | OPEN |
| PERF-16 | P3 | Version check bypasses browser cache and retries indefinitely | Low request/background-work improvement | Low | High | OPEN |
| PERF-17 | P3 | Infinite-scroll has duplicate proximity mechanisms | Low scroll-handler reduction | Low | Medium | OPEN |
| PERF-18 | P3 | Settings client component is monolithic | Low-medium settings-route improvement | Medium | Medium | OPEN |
| PERF-19 | P3 | Small repeated computations and high-frequency logo animation | Minor CPU improvement | Low | High | OPEN |
| PERF-20 | P3 | Deployment restart and configuration tuning opportunities | Operational rather than request-path improvement | Low-medium | Medium | OPEN |

## Baseline and methodology

### Methods used

- Traced the request path from the search form through the Next.js API, preferences, rate limiter, SearXNG client, transformation layer, and result renderer.
- Inspected the existing production build and prerender manifest.
- Ran the Next.js Turbopack bundle analyzer and inspected route/module composition.
- Measured local requests through the running Caddy/Next.js/SearXNG/Valkey stack during the sampling window.
- Tested representative favicon and optimized-logo requests.
- Reviewed current official Next.js, React, Node.js, Redis, next-intl, and SearXNG guidance.

### Limitations

- These are local samples, not production p50/p95/p99 measurements.
- No Lighthouse or throttled mobile CPU profile was available.
- Search engines are externally variable, so individual request timings do not increase monotonically even when code does more work.
- Gzip figures are per-file offline gzip estimates. Caddy can serve zstd or gzip, so exact network transfer sizes will vary.

### Route JavaScript

| Route | Initial JavaScript, raw | Per-file gzip estimate |
| --- | ---: | ---: |
| `/search` | 844.0 KiB | 246.9 KiB |
| `/` | 760.2 KiB | 225.4 KiB |
| `/settings` | 759.6 KiB | 222.7 KiB |
| `/privacy` | 735.6 KiB | 216.3 KiB |
| `/_not-found` | 670.5 KiB | 194.9 KiB |

Additional bundle observations:

- Approximately 670.5 KiB raw / 194.9 KiB gzip is common to every route.
- A home-to-search transition requires approximately 173.5 KiB raw / 52.0 KiB gzip of additional JavaScript when common chunks are cached.
- Shared generated CSS is approximately 108.7 KiB raw / 19.0 KiB gzip and is not a priority.
- Search is the largest route but is not exceptionally large for a React/Next application; unnecessary common modules and the calculator trigger are the actionable parts.

### HTML and server response samples

| Route | HTML bytes | Compressed transfer observed | Warm local TTFB |
| --- | ---: | ---: | ---: |
| `/` | 45,272 | 13,646 | Approximately 10-12 ms |
| `/privacy` | 43,532 | 14,375 | Approximately 8-9 ms |
| `/settings` | 63,595 | 14,450 | Approximately 12-13 ms |
| `/search` | 56,002 | 14,819 | Approximately 8 ms |

The first sampled home request was approximately 99 ms. `/api/health` was approximately 2 ms.

### Search and autocomplete samples

- `/api/search?q=nextjs performance&tab=all&page=1`: approximately 948 ms application duration.
- Page 2: approximately 731 ms.
- Page 3: approximately 924 ms.
- External engine variation obscures monotonic growth, but the code path conclusively repeats earlier work.
- Typing `nextjs` produced calls for `ne`, `nex`, `next`, `nextj`, and `nextjs`.
- Those five calls represented approximately 427 ms of aggregate backend work, although the user-visible wait is lower because browser requests overlap and are aborted.

### Static rendering and caching

- The prerender manifest only contained `/_global-error` and `/icon.png`.
- `/`, `/privacy`, `/settings`, and `/search` were dynamic.
- Live responses used `private, no-cache, no-store, max-age=0, must-revalidate`.
- Root-level `cookies()` access is the reason non-search routes cannot be statically served.

## Detailed findings

### PERF-01: Pagination re-fetches previous upstream pages

- **Priority:** P0
- **Status:** DONE
- **Evidence:** [`src/features/search/server/searx-client.ts`](src/features/search/server/searx-client.ts#L610), [`src/features/search/server/search-pagination.ts`](src/features/search/server/search-pagination.ts#L139), [`src/features/search/server/search-continuation-store.ts`](src/features/search/server/search-continuation-store.ts#L224), [`src/features/search/components/search-page-client.tsx`](src/features/search/components/search-page-client.tsx#L515)

#### Problem

For every non-video UI page, the server:

1. Calculates the total number of results needed through the requested page.
2. Starts `upstreamPage` at 1.
3. Sequentially fetches upstream pages.
4. Aggregates and deduplicates all previous results.
5. Slices out only the requested UI page.

With roughly 20 unique upstream results per page, UI pages 1-3 can require approximately 2 + 3 + 4 = 9 SearXNG requests instead of 3 because the server also fetches a lookahead result to determine `hasMore`.

The hard code-path bound across 12 UI pages is 12 API requests multiplied by 12 upstream pages, or 144 upstream requests. Direct navigation to `?page=N` adds another sequential loop in the client, requesting API pages 1 through N.

#### Recommended design

- Introduce a short-lived opaque continuation cursor.
- Store the next upstream page, seen URL hashes, and overflow results in Valkey or a bounded in-memory LRU.
- Bind the cursor to the normalized query, tab, locale/filter parameters, and runtime preferences.
- Use random cursor IDs or HMAC-derived keys rather than raw search queries in cache keys.
- Apply a short TTL, for example two to five minutes.
- Continue from the next upstream page instead of restarting at page 1.

Lower-risk first stage:

- Cache individual upstream page responses for a short TTL while preserving the current aggregation algorithm.
- This immediately prevents repeated external calls without redesigning the client contract.

Do not blindly parallelize all upstream pages: deduplication, early termination, result quality, and engine load make continuation a better fit.

#### Implementation (2026-07-31)

- Non-video searches now return an opaque continuation cursor and resume from the next unconsumed SearXNG page.
- Continuations retain only a SHA-256 request/runtime fingerprint, hashed seen-result URLs, bounded overflow results, counters, and the next page number. Search queries are not present in cursor IDs or Valkey key names.
- Shared state uses Valkey when configured, with a five-minute TTL. Consumed cursors are reduced to a 60-second retry window. A 1,000-entry process-local LRU-style fallback keeps single-instance development and Redis-outage behavior bounded.
- Serialized continuation records are validated and limited to 256 KiB; seen results, overflow results, UI page size, cursor length, page number, and environment overrides also have explicit bounds.
- A missing, expired, or mismatched cursor is rebuilt in one linear pass through the required upstream pages. This preserves direct URL navigation without the former nested replay behavior.
- A full result page no longer triggers a speculative lookahead request. Unknown exhaustion is carried in the continuation and resolved by the next request.
- Video pagination uses the same opaque, query/runtime-bound continuation store, preserving overflow results, URL deduplication, and engine continuation data. Direct video recovery is linear, and legacy engine-data cursors remain accepted.
- The rate limiter and continuation store share one process-wide ioredis connection when they use the same Valkey URL.

#### Acceptance criteria

- [x] Loading UI page N never refetches upstream pages already consumed by the same continuation.
- [x] Direct navigation to a later page does not produce nested replay loops.
- [x] Cursor state is validated and bounded.
- [x] Query data is not written to logs or cache key names.
- [x] Existing result ordering, deduplication, `hasMore`, and page-size behavior remain correct.
- [x] Video continuation remains correct.

#### Validation

- [x] Unit tests cover pages 1 through 12 at both 20 and 40 results per page; each upstream page is fetched exactly once.
- [x] Unit tests cover ordering, URL deduplication, duplicate-only upstream pages, immutable retry state, and direct-page linearity.
- [x] A local Compose check returned 20 unique results on both pages 1 and 2 with zero cross-page duplicate URLs.
- [x] A local video check at 10 results per page preserved overflow across pages 1 and 2, returned full pages, and produced zero cross-page duplicate URLs.
- [x] The local Valkey record used an opaque key, a roughly five-minute TTL, and a 60-second consumed-cursor retry TTL.
- [x] Tests, targeted Biome checks, TypeScript, production builds, Compose configuration validation, and React Doctor pass.
- [ ] Add `upstream_page_count` telemetry under PERF-14 and compare production request counts.
- [ ] Load test concurrent production-like traffic to establish a cursor-state capacity budget.

### PERF-02: Initial search starts after hydration and search forms reload the document

- **Priority:** P0
- **Status:** DONE
- **Evidence:** [`src/app/search/page.tsx`](src/app/search/page.tsx#L51), [`src/features/search/server/search-service.ts`](src/features/search/server/search-service.ts#L46), [`src/features/search/components/search-page-client.tsx`](src/features/search/components/search-page-client.tsx#L377), [`src/features/search/components/search-form.tsx`](src/features/search/components/search-form.tsx#L57)

#### Problem

The search page server component only loads preferences. Results are requested by a client effect after hydration. Search forms use native GET submission, so home-to-search and search-to-search submissions cause full document navigations.

On a cold direct load, the browser must receive dynamic HTML, download and parse the search JavaScript, hydrate the client, run the effect, call `/api/search`, and then wait for SearXNG. Even after visiting home, the transition still requires approximately 52 KiB gzip of search-specific JavaScript and re-executes the application after a full navigation.

#### Recommended design

Best version:

- Parse `searchParams` in the server page.
- Start the initial search during server rendering.
- Stream the shell with a Suspense fallback while results resolve.
- Pass serializable `initialData` to `SearchPageClient`.
- Prevent the client effect from issuing a duplicate request when initial data matches the active query.
- Keep `/api/search` for filters, new client-side searches, and pagination.
- Extract a shared, rate-limited server search service so the server page and API route use identical validation, preference, IP-forwarding, and transformation logic.

Quick win:

- Keep native form submission as progressive enhancement.
- When JavaScript is active, intercept submit and use `router.push` so the already-hydrated application is preserved.

#### Implementation

- The search page now resolves URL defaults, starts its initial search without awaiting it, and streams that promise to the client. React `use()` unwraps the result inside a Suspense boundary keyed by the canonical request identity, so every new query immediately resets to the loading UI while the server search continues.
- The API route and server-rendered page both call the same search service for validation, rate limiting, persisted runtime preferences, trusted client metadata forwarding, SearXNG access, transformation, and localized errors.
- Direct later-page loads preserve the existing accumulated-results behavior while advancing with opaque continuation cursors; the shared response merge keeps result ordering and URL deduplication intact.
- The client initializes from matching server data and treats the canonical URL, requested page, and runtime preferences as the identity, so its effect does not repeat the initial request. URL changes and load-more requests can still use `/api/search`.
- Search forms retain `method="GET"` and their action for no-JavaScript use, while hydrated same-origin submissions use `router.push` inside `useTransition`. The search icon becomes a spinner immediately, then only the results area switches to its keyed skeleton while the real header and entered query remain visible. Search suggestion links disable automatic prefetch so merely entering the viewport cannot start an upstream search.

#### Acceptance criteria

- [x] Initial search work begins before search-page hydration completes.
- [x] A direct `/search?q=...` load produces no duplicate search request.
- [x] Home-to-search navigation is client-side when JavaScript is enabled.
- [x] Native GET submission still works when JavaScript is unavailable.
- [x] Rate limits and client-IP forwarding are identical for server-started and API searches.

#### Validation

- [x] A headless Brave cold direct load produced zero browser `/api/search` requests and no framework overlay or console errors.
- [x] The same run observed streamed navigation timing with `responseStart` at about 150 ms and `responseEnd` at about 1.09 s while the local SearXNG search completed.
- [x] Warm home-to-search and search-to-search submissions produced no document requests. Headless Brave observed the form spinner after about 11-15 ms and the results-only skeleton after about 59-96 ms, with the entered query and search shell retained.
- [x] Browser back/forward restored both search URLs without an overlay; a JavaScript-disabled submission produced one native `/search` document request with `method="GET"`.
- [x] Unit tests cover canonical request identities across URL ordering, page and runtime changes, plus server/client-equivalent result aggregation and deduplication.
- [x] Targeted Biome checks, TypeScript, the production build, and React Doctor pass.
- [ ] Add production `time_to_first_result` telemetry under PERF-14 and compare cold, warm, throttled, and mobile profiles.

### PERF-03: Browser cancellation does not stop upstream work

- **Priority:** P0
- **Status:** DONE
- **Evidence:** [`src/server/upstream-fetch.ts`](src/server/upstream-fetch.ts#L1), [`src/features/search/server/searx-client.ts`](src/features/search/server/searx-client.ts#L292), [`src/features/search/server/search-service.ts`](src/features/search/server/search-service.ts#L45), [`src/app/api/search/route.ts`](src/app/api/search/route.ts#L9), [`src/app/api/autocomplete/route.ts`](src/app/api/autocomplete/route.ts#L84), [`src/app/api/favicon/route.ts`](src/app/api/favicon/route.ts#L75)

#### Problem

The browser aborts stale search and autocomplete requests, but server fetches use only `AbortSignal.timeout`. Navigation, filter changes, tab switches, or continued typing can therefore cancel the browser request while Next.js and SearXNG continue doing work.

#### Recommended design

- Add `signal?: AbortSignal` to the SearX runtime options.
- Pass `request.signal` from the route into the search service.
- Compose request cancellation and timeout cancellation with:

```ts
AbortSignal.any([
  request.signal,
  AbortSignal.timeout(REQUEST_TIMEOUT_MS),
])
```

- Apply the same pattern to autocomplete and favicon fetches.
- Distinguish aborts from genuine upstream failures so disconnected clients do not create misleading errors.

#### Acceptance criteria

- [x] Aborting `/api/search` aborts the active SearXNG fetch.
- [x] Aborting autocomplete stops the upstream autocompleter request.
- [x] Timeout behavior remains intact.
- [x] Aborts do not appear as backend failures in logs or metrics.

#### Implementation (2026-08-01)

- A shared upstream-fetch helper composes each request's cancellation signal with the endpoint's existing timeout through `AbortSignal.any`.
- `/api/search` passes `request.signal` through the shared search service and SearX runtime options. Both the JSON search request and the parallel video engine-data request now stop on client cancellation.
- Search cancellation is rethrown instead of being converted to `backendUnavailable`; the route consumes it as a bodyless HTTP 499 response, keeping disconnects distinct from backend errors.
- Autocomplete and favicon proxy requests use the same composition and bodyless client-closed response while preserving their existing fallback behavior for timeouts and provider failures.
- Aborts that occur while consuming JSON or HTML response bodies are handled consistently, not misclassified as invalid upstream payloads.

#### Validation

- [x] Unit tests verify that client cancellation reaches the active upstream fetch, timeout cancellation remains active, and client-closed responses are bodyless HTTP 499 responses.
- [x] Against a deliberately 15-second loopback upstream, disconnecting the search client closed the SearX request after 694 ms and disconnecting autocomplete closed its request after 701 ms.
- [x] Without client cancellation, search retained its HTTP 503 response at approximately 8.01 seconds and autocomplete retained its empty HTTP 200 response at approximately 5.01 seconds.
- [x] Next.js development logs reported the disconnected requests without backend failure errors.
- [x] A normal direct search rendered 20 results without a duplicate browser API request; load-more rendered another 20 through the modified route with no overlay or captured console errors.
- [x] Tests, targeted Biome checks, TypeScript, the production build, and changed-scope React Doctor pass.

### PERF-04: Autocomplete has zero debounce and fetches while unfocused

- **Priority:** P0
- **Status:** DONE
- **Evidence:** [`src/features/search/lib/autocomplete-client.ts`](src/features/search/lib/autocomplete-client.ts#L1), [`src/features/search/components/use-autocomplete.ts`](src/features/search/components/use-autocomplete.ts#L1), [`src/features/search/components/search-suggestions.tsx`](src/features/search/components/search-suggestions.tsx#L1), [`src/features/search/components/search-input.tsx`](src/features/search/components/search-input.tsx#L26)

#### Problem

`AUTOCOMPLETE_DEBOUNCE_MS` is zero. Every character from length two dispatches a request. The effect depends on `isFocused` but does not return early when unfocused, so blur/focus changes can issue another request for the same query.

React Doctor 0.9.3 also flags the 382-line `SearchInput` file as a valid maintainability warning. It predates PERF-03 and is best addressed with PERF-04 by extracting autocomplete state/network behavior and the suggestion panel, rather than mixing an unrelated component refactor into the cancellation branch.

#### Recommended design

- Use an 80 ms debounce to coalesce fast typing bursts while keeping added suggestion latency low.
- Return early when the input is unfocused.
- Normalize query keys and add a bounded in-memory TTL cache.
- Deduplicate identical in-flight queries.
- Keep autocomplete query caching memory-only for privacy.
- Combine with PERF-03 so superseded requests stop upstream work.

#### Acceptance criteria

- [x] Normal typing of a six-character query usually produces one autocomplete request.
- [x] Blurring an input does not trigger a request.
- [x] Refocusing can reuse a recent exact-query result.
- [x] Keyboard, screen-reader, and suggestion-selection behavior is unchanged.

#### Implementation (2026-08-01)

- Autocomplete waits 80 ms after the final normalized input change and is disabled whenever the field is unfocused or a search navigation is pending. Query changes clear stale visible suggestions immediately.
- A browser-memory-only request manager normalizes whitespace and case for request identity, retains up to 40 positive results for two minutes with least-recently-used eviction, and never persists query text to browser storage.
- Identical active queries share one fetch. Each consumer keeps independent cancellation semantics; canceling one subscriber preserves work needed by another, while canceling the last subscriber aborts the browser request and reaches PERF-03's server-side upstream cancellation path.
- Client and API validation now use the same minimum, maximum, and eight-result limits. Invalid lengths never reach the endpoint, and empty or failed responses are not cached so transient upstream failures cannot poison future suggestions.
- Networking/state moved into `useAutocomplete`, while viewport sizing, option rendering, and selected-option scrolling moved into `SearchSuggestions`. `SearchInput` dropped from 382 to 216 lines and no longer triggers React Doctor's giant-component warning.
- Selecting a suggestion ends the autocomplete session before submitting, and pending form navigation disables new suggestion work. This prevents an extra request for the selected text while the search route is loading.

#### Validation

- [x] Fast browser typing of `google` produced one `/api/autocomplete?q=google` resource and rendered exactly eight options.
- [x] An atomic type-and-blur interaction followed by 500 ms produced zero autocomplete resources; the panel remained closed.
- [x] After one `privacy` request, blur/refocus restored eight cached options after more than the debounce interval with the resource count still at one.
- [x] The suggestion list retained `overflow-y: auto`, a 13 px viewport gap, and kept the eighth keyboard-selected option visible with one `aria-selected="true"` option and a matching `aria-activedescendant`.
- [x] Keyboard selection navigated to the selected search query without a runtime overlay. Final server and browser resource logs contained only the original autocomplete request, not an extra request for the selected text.
- [x] Unit tests cover normalization, the client limit, TTL and LRU eviction, in-flight deduplication, shared-subscriber cancellation, final-subscriber upstream abort, invalid lengths, and pre-canceled consumers.
- [x] Tests, targeted Biome checks, TypeScript, the production build, and changed-scope plus full React Doctor pass.

### PERF-05: Fresh-result mode still serializes the full cache

- **Priority:** P1
- **Status:** DONE
- **Evidence:** [`src/features/settings/lib/preferences.ts`](src/features/settings/lib/preferences.ts#L102), [`src/features/search/components/search-page-client.tsx`](src/features/search/components/search-page-client.tsx#L474), [`src/features/search/lib/search-result-cache.ts`](src/features/search/lib/search-result-cache.ts#L78)

#### Problem

The default result reuse mode is `fresh`. Reads are conditional on cache mode, but writes occur unconditionally after initial results and load-more.

Every write prunes and sorts all entries, stringifies all result payloads, synchronously replaces the complete `sessionStorage` value, and serializes again after quota failure. With up to 20 entries and hundreds of accumulated results, this can block the main thread.

#### Recommended design

- Never call `writeSearchCache` in fresh mode.
- In cache mode, persist pages or entries incrementally.
- Throttle persistence through an idle callback with a safe fallback.
- Cap the cache by serialized bytes, not only entry count.
- Consider memory-only caching unless cross-navigation persistence is required.
- Avoid retrying a full second serialization after quota failure.

#### Acceptance criteria

- [x] Fresh mode performs no result serialization or session-storage writes.
- [x] Cache mode remains functional across route transitions.
- [x] Long result sessions do not create visible input or scroll stalls.
- [x] Storage remains bounded and stale entries are removed.

#### Implementation (2026-08-01)

- Every initial-result, fetched-result, and load-more cache write is gated by `resultReuseMode === "cache"`. The cache API also rejects fresh-mode reads and writes before loading its index, scheduling work, or touching `sessionStorage`.
- Cache-mode writes update the bounded memory cache immediately, then coalesce persistence through `requestIdleCallback` with a one-second timeout and a short timer fallback. Repeated writes for the same search before the callback serialize only the newest result.
- The former monolithic payload was replaced with a small index and one storage value per search key. Updating one visited search no longer sorts and serializes every cached result payload, and stored entries are loaded lazily only when requested.
- Persisted result data is limited to 20 entries, 30 minutes, and 2 MiB of serialized entry data. Oldest entries are evicted before a write exceeds either bound; expired, malformed, missing, and oversized entries are removed or kept memory-only as appropriate.
- Storage quota or security failures do not trigger a second serialization attempt. Memory caching remains available for the active browser session, while incomplete persistent writes are excluded from the index.
- The legacy `adminsearch-search-results-cache-v4` monolithic value is removed only when opt-in cache mode first initializes. No settings, controls, result rendering, loading states, or navigation behavior changed.

#### Validation

- [x] Unit tests prove fresh mode performs no storage reads, writes, scheduling, or serialization; deferred writes coalesce; changed entries persist incrementally; a new cache instance restores stored results; and TTL, count, byte, oversized-entry, and quota-failure behavior remains bounded.
- [x] A browser check against a deterministic loopback upstream rendered 20 results in fresh mode and 40 accumulated results after cache-mode load-more, with the existing layout and controls, no framework overlay, and no console warnings or errors.
- [x] All 31 tests, targeted Biome checks, TypeScript, the production build, and React Doctor pass.

### PERF-06: Every non-empty query loads mathjs

- **Priority:** P1
- **Status:** DONE
- **Evidence:** [`src/features/search/components/search-page-client.tsx`](src/features/search/components/search-page-client.tsx#L1211), [`src/features/search/lib/calculator.ts`](src/features/search/lib/calculator.ts#L1)

#### Problem

The calculator is dynamically imported for every non-empty query when the calculator setting is enabled by default. The dynamic import is correct, but the trigger is too broad.

Measured calculator chunk:

- 143,273 bytes raw.
- Approximately 39.3 KiB gzip.
- Approximately 33.2 KiB Brotli.

Normal text queries download and parse the chunk only for the calculator to reject the expression.

#### Recommended design

- Add a cheap, conservative `looksLikeExpression` check before importing mathjs.
- Support numbers, operators, parentheses, constants, and known function names without accepting general prose.
- Alternatively, remove the client calculator and rely on the enabled SearXNG calculator plugin if delayed server results are acceptable.

#### Acceptance criteria

- [x] Ordinary text searches do not request the calculator chunk.
- [x] Supported mathematical expressions still load and calculate correctly.
- [x] Invalid expressions fail without user-visible errors.

#### Implementation (2026-08-01)

- Added a dependency-free `looksLikeCalculatorExpression` scanner that runs before the existing dynamic import. It accepts decimal and scientific numbers, the configured arithmetic operators, balanced parentheses, `pi`/`e`, and the exact functions already provided to the calculator.
- The scanner rejects unknown identifiers, prose, URLs, assignments, unbalanced parentheses, top-level commas, unsupported characters, and inputs longer than 256 characters before `mathjs` can download.
- Ambiguous but math-like syntax may still reach the existing evaluator; its established exception handling returns no answer without surfacing an error. The calculator implementation and answer rendering are unchanged.
- The effect clears any previous calculator result and returns before `import("@/features/search/lib/calculator")` for disabled or non-mathematical queries. No search controls, result markup, loading states, styling, or settings changed.

#### Validation

- [x] Unit tests cover ordinary searches, product/version queries, URLs, unknown functions, malformed expressions, decimal/scientific syntax, constants, operators, and every configured calculator function.
- [x] The production build retains a separate 143,273-byte calculator chunk (39,436 bytes with offline gzip).
- [x] A production-mode browser check showed `nextjs performance` rendering 20 results with 11 scripts and no calculator chunk. `1+1` loaded exactly one additional script—the calculator chunk—and preserved the existing `1 + 1 = 2` answer.
- [x] A malformed math-like query rendered 20 normal results with no calculator answer, framework overlay, console warning, or console error.
- [x] All 35 tests, targeted Biome checks, TypeScript, the production build, and React Doctor pass.

### PERF-07: Load-more rerenders every accumulated result

- **Priority:** P1
- **Status:** DONE (2026-08-01)
- **Evidence:** [`src/features/search/components/result-list.tsx`](src/features/search/components/result-list.tsx#L18), [`src/features/search/components/search-page-client.tsx`](src/features/search/components/search-page-client.tsx#L117)

#### Problem

The merge function preserves existing result object references, but `ResultCard` and `VideoResultCard` are not memoized. A load-more state change maps and rerenders all prior results. The configured limit can reach 480 displayed results.

#### Recommended design

1. Add `content-visibility: auto` and `contain-intrinsic-size` to result cards and image tiles.
2. Memoize web and video cards because existing result references remain stable.
3. Extract and memoize image-grid tiles.
4. Test the stable React Compiler in annotation mode as an alternative or complement to manual memoization.
5. Introduce full virtualization only if profiling still shows a problem; dynamic heights, browser find, SEO, and accessibility raise its complexity.

#### Acceptance criteria

- [x] Loading a new page does not rerender unchanged result cards.
- [x] Offscreen results avoid unnecessary layout and paint work.
- [x] Focus, screen-reader navigation, browser find, and scroll position remain correct.
- [x] No custom comparator performs more work than the avoided render.

#### Implementation (2026-08-01)

- Wrapped `ResultCard` and `VideoResultCard` in `React.memo` with React's default shallow comparison. Pagination already preserves every accumulated result object, so unchanged cards now bail out before their URL parsing, metadata formatting, translation, and JSX work.
- Extracted each image result into a memoized `ImageResultTile`. `ImageGrid` passes a stable `useCallback` selector plus stable result references and primitive preference props, while dialog ownership and the opener ref remain in `ImageGrid`.
- Added `content-visibility: auto` and a type-specific `contain-intrinsic-size` to web cards, video cards, and image tiles. This lets the browser defer offscreen layout and paint while keeping every result in the DOM for native focus, find-in-page, and assistive technology behavior.
- Used no custom comparators and did not introduce virtualization. Result markup, copy, ordering, link behavior, image-dialog behavior, responsive layout classes, and visible styling remain unchanged.
- Added strict identity assertions around `mergeSearchResponses` so the reference-stability contract that makes shallow memoization effective is covered by the test suite.

#### Validation

- [x] All 35 tests pass, including accumulated-result identity checks; targeted Biome checks and TypeScript pass.
- [x] The production build passes and its generated CSS contains the expected `content-visibility: auto` rule plus 160 px, 240 px, and 280 px intrinsic-size fallbacks.
- [x] Changed-scope React Doctor reports no issues.
- [x] Production-mode browser checks with a deterministic four-page upstream appended web, image, and video results to 40 items without an error overlay or captured console errors; computed styles were correct on every rendered item.
- [x] The 40-result accessibility snapshot includes both the first and last video result. Image preview open/close retained its dialog semantics and returned focus to the exact opening tile.

### PERF-08: Favicons fail through `next/image` and fan out to external providers

- **Priority:** P1
- **Status:** DONE (2026-08-01)
- **Evidence:** [`src/features/search/components/site-favicon.tsx`](src/features/search/components/site-favicon.tsx#L23), [`src/features/search/components/image-grid.tsx`](src/features/search/components/image-grid.tsx#L194), [`src/app/api/favicon/route.ts`](src/app/api/favicon/route.ts#L48), [`next.config.ts`](next.config.ts#L52)

#### Problem

Favicon components pass query-bearing `/api/favicon?...` sources to `next/image`. A representative `/_next/image` request returned HTTP 400 with `"url" parameter is not allowed` because the generated local image pattern permits no search parameters.

The favicon route also:

- Reads preferences even when the resolver is explicitly present in the URL.
- Uses `cache: "no-store"` for provider fetches.
- Can create one external provider request per unique result hostname.

Representative timings:

- Google: approximately 53 ms cold, 15 ms warm, 519 bytes.
- DuckDuckGo: approximately 120 ms cold, 28 ms warm, 6.5 KiB.

#### Recommended design

- Use native `<img>` or `unoptimized` for already tiny favicons.
- Request `/api/favicon` directly rather than routing through the image optimizer.
- Skip preference parsing when a valid resolver parameter is supplied.
- Add a bounded shared server cache/revalidation period for successful favicons.
- Add shorter negative caching for missing or failed favicons.
- Preserve content-type validation and authority normalization.

#### Acceptance criteria

- [x] Favicons render instead of falling back because of image-optimizer 400 responses.
- [x] Tiny favicon responses bypass Next.js image transformation.
- [x] Repeated hostnames reuse browser/server cache entries.
- [x] Invalid authorities remain rejected.

#### Implementation (2026-08-01)

- Both web-result and image-result favicon components now mark their query-bearing same-origin sources as `unoptimized`, so the browser requests `/api/favicon` directly instead of sending tiny icons through `/_next/image`.
- A browser regression check confirmed that the previously failing Google search renders without a Next.js error overlay, returns complete 32-pixel favicons, and issues zero optimized favicon requests.
- The route now uses a process-shared LRU cache capped at 256 entries and 4 MiB. Successful provider responses remain warm for 24 hours; failed, missing, invalid-content-type, empty, and oversized responses use a five-minute negative entry.
- Concurrent requests for the same normalized authority and resolver share one in-flight provider request. A canceled HTTP caller no longer aborts provider work that another caller is awaiting, while the canceled caller still receives the existing explicit 499 response.
- Explicit resolver parameters bypass preference-cookie parsing. Provider payloads must be successful, non-empty `image/*` responses no larger than 256 KiB before they can be returned or cached.
- Successful responses use the existing one-day browser cache plus seven-day stale revalidation; negative responses now advertise a five-minute browser cache. Malformed authorities remain HTTP 400.

#### Validation (2026-08-01)

- [x] All 40 tests pass, including in-flight deduplication, warm success reuse, shorter negative expiry, LRU/byte eviction, oversized-entry rejection, resolver preference bypass, authority normalization, and content-type validation.
- [x] TypeScript, targeted Biome checks, and the production build pass.
- [x] On a fresh production server, a successful DuckDuckGo favicon request took 118.5 ms cold and 2.2 ms warm; a provider miss took 115.8 ms cold and 2.2 ms from the negative cache. These are controlled samples, not p95 claims.
- [x] Production browser verification rendered 20 repeated-host GitHub favicons at their complete 32-pixel natural width. All 20 image sources pointed directly to `/api/favicon`, with zero `/_next/image` favicon sources, no framework overlay, and no captured console errors.
- [x] The production route returned the intended success and negative cache headers, preserved the provider's `image/png` or `image/x-icon` content type, and returned HTTP 400 for a path-bearing authority.

### PERF-09: Large global client dependency baseline

- **Priority:** P1
- **Status:** DONE (2026-08-01)
- **Evidence:** [`src/app/layout.tsx`](src/app/layout.tsx#L44), [`src/components/site/language-select.tsx`](src/components/site/language-select.tsx#L49), [`src/components/site/searxng-version-indicator.tsx`](src/components/site/searxng-version-indicator.tsx#L31)

#### Problem

Approximately 194.9 KiB gzip of JavaScript is common to every route, including the not-found route. The framework accounts for a large irreducible portion, but several application-level dependencies are globally present.

Bundle-analyzer estimates included:

- Sonner: approximately 17.8 KiB Brotli.
- Radix Select: approximately 13.1 KiB.
- Radix Tooltip: approximately 6.1 KiB, plus positioning dependencies.
- ICU message parser: approximately 15.6 KiB.
- `intl-messageformat`: approximately 5.8 KiB.
- Preferences module: approximately 5.8 KiB.
- `tailwind-merge`: approximately 16-24 KiB depending on route accounting.

#### Recommended design

- Move the global Sonner toaster into the settings route, the only route that emits toasts.
- Replace the two-option language Radix Select with a styled native `<select>` if the UX is acceptable.
- Replace the single global version-status tooltip with a lighter accessible treatment if possible.
- Reduce client-side translation use as described in PERF-12.
- Treat replacement of `tailwind-merge` as lower priority because class override behavior must be audited carefully.

#### Acceptance criteria

- [x] Sonner is absent from non-settings routes.
- [x] Language selection retains keyboard and screen-reader accessibility.
- [x] Common gzip JavaScript decreases measurably.

#### Implementation (2026-08-01)

- Removed the Sonner toaster from the root layout and rendered the identical configured toaster only on `/settings`, the sole route that imports `toast` or emits notifications.
- The settings page returns the toaster immediately after its existing `<main>`, preserving its prior order under the same theme, internationalization, and tooltip providers. Toast position, width, icons, live-region behavior, maximum visible count, styling, and actions are unchanged.
- Kept the existing Radix language selector and version tooltip untouched. Moving Sonner alone meets the acceptance criteria, so changing those visible and accessible controls would add UX risk without being necessary for this item.

#### Validation

- [x] Production client-reference manifests contain `components/ui/sonner.tsx` only for `/settings`; home, search, privacy, and not-found manifests do not contain it.
- [x] Using the same production-build measurement method, home-route entry JavaScript fell from 328,173 to 292,174 bytes raw, from 102,047 to 92,343 bytes gzip, and from 90,231 to 81,619 bytes Brotli. That removes 35,999 raw bytes, 9,704 gzip bytes, and 8,612 Brotli bytes from the representative non-settings route.
- [x] The settings entry remained effectively flat at 96,949 bytes gzip versus 96,782 before (+167 bytes from chunk reshaping) while retaining the route's required Sonner code.
- [x] Production browser verification confirmed the home route has no notification live region. The settings route still exposes its labelled language combobox and notification region; changing Compact density produced the unchanged unsaved-changes toast with working Discard and Save changes actions, and Discard restored the original switch state.
- [x] All 41 tests, targeted Biome checks, TypeScript, the production build, and changed-scope React Doctor pass with no framework overlay or captured console errors.
- [x] Not-found and privacy routes do not load settings-only UI libraries.

### PERF-10: Both theme logos are eagerly preloaded

- **Priority:** P2
- **Status:** DONE (2026-08-01)
- **Evidence:** [`src/components/site/theme-logo.tsx`](src/components/site/theme-logo.tsx#L12), [`src/app/page.tsx`](src/app/page.tsx#L28)

#### Problem

Both light and dark `next/image` elements receive `priority`, so the HTML contains two image preloads although only one logo is visible.

The source PNGs are both 1254x1254:

- `public/logo_dark.png`: approximately 373 KiB.
- `public/logo_white.png`: approximately 688 KiB.
- Representative browser WebP responses totaled approximately 68 KiB for both variants.

#### Recommended design

- Render only the theme known from the server preference.
- For system theme, use `<picture>` with `prefers-color-scheme` media selection or a single themeable SVG/mask.
- Pre-resize and optimize source artwork to reduce cold optimizer CPU and build size.
- Test PNG, WebP, and SVG rather than assuming WebP is smallest for line art.

#### Acceptance criteria

- [x] Only one logo asset is preloaded and downloaded on initial home load.
- [x] Theme switching still produces the correct logo without a disruptive flash.
- [x] Home LCP does not regress.

#### Implementation (2026-08-01)

- The home page passes its server-read appearance preference into the logo, which now renders one responsive optimized image for explicit light or dark mode instead of two CSS-hidden `next/image` elements.
- System mode uses a native `<picture>` source selected by `prefers-color-scheme`. Its light and dark preload candidates carry mutually exclusive media conditions, so the browser applies only the candidate matching the operating-system theme.
- The selected logo remains eager and high-priority, retains the existing 176-pixel responsive sizing and translated alternative text, and follows `next-themes` after hydration so the existing light/dark transition continues to swap artwork correctly.
- Both original PNG variants and all layout, animation, spacing, and theme-toggle behavior remain unchanged.

#### Validation (2026-08-01)

- [x] Before the change, a production browser load contained two unconditional responsive image preloads and two complete 176x176 logo images, including the `display: none` variant. The final explicit-light load contains one responsive preload and one complete 176x176 image.
- [x] The final production browser selected `/logo_dark.png` in light mode and `/logo_white.png` in dark mode. Immediate post-toggle checks found the replacement image complete at 176x176 with no hidden duplicate, framework overlay, layout change, or visible flash.
- [x] System-following-dark rendered one image whose current source was `/logo_white.png`; its `<picture>` source and applicable preload both used `(prefers-color-scheme: dark)`, while the alternate preload was limited to `(prefers-color-scheme: light)`.
- [x] The LCP-critical image remains responsive-preloaded, `loading="eager"`, and `fetchPriority="high"` at the same dimensions and position. Removing the competing preload reduces the representative 384-pixel optimized logo transfer from both 18,292-byte and 17,475-byte responses to only the selected response. This is a controlled local guard rather than a production p95 claim.
- [x] All 42 tests, targeted Biome checks, TypeScript, the production build, and changed-scope React Doctor pass. Production screenshots match the prior light layout and the expected dark layout, with no framework error overlay.

### PERF-11: Root cookie access makes every public route dynamic

- **Priority:** P2
- **Status:** OPEN
- **Evidence:** [`src/app/layout.tsx`](src/app/layout.tsx#L49), [`src/features/settings/server/preferences.ts`](src/features/settings/server/preferences.ts#L8), [`src/i18n/request.ts`](src/i18n/request.ts#L9), [`src/app/privacy/page.tsx`](src/app/privacy/page.tsx#L14)

#### Problem

The root layout reads preferences through `cookies()`, opting every descendant route into dynamic rendering. Home, search, and settings also call the preference loader again, while next-intl reaches it through request configuration.

Consequences:

- Privacy cannot be statically served.
- All public HTML is private/no-store.
- Every request performs preference parsing.
- The full default cookie is approximately 899 bytes of JSON, 1,367 bytes URL-encoded, or about 1,388 bytes including its name.
- Because `Path=/` is used, the cookie is attached to all same-origin requests. HTTP/2 header compression mitigates repeated transmission but not the first request or server parsing.

#### Recommended design

- Split SSR-critical UI settings from search runtime preferences.
- Keep only a compact locale/theme/color-theme cookie at `/`.
- Scope search-specific state to `/api/search` or send a compact, validated runtime payload only with search requests.
- Keep non-SSR preferences in local/session storage.
- Make privacy and other non-personalized routes statically renderable.
- Wrap repeated Server Component preference reads in one module-level `cache()` function.
- Do not expect request memoization alone to make the route static; cookie access must be isolated or removed from the static path.

#### Acceptance criteria

- [ ] Privacy is prerendered or otherwise publicly cacheable.
- [ ] Search and settings retain correct personalized defaults.
- [ ] Preference parsing occurs once per relevant server render.
- [ ] Cookie size and path scope are reduced.
- [ ] No theme flash or locale mismatch is introduced.

### PERF-12: All translation messages are sent to every client route

- **Priority:** P2
- **Status:** OPEN
- **Evidence:** [`src/app/layout.tsx`](src/app/layout.tsx#L62), [`src/i18n/request.ts`](src/i18n/request.ts#L15), [`messages/en.json`](messages/en.json), [`messages/de.json`](messages/de.json)

#### Problem

`NextIntlClientProvider` inherits the complete locale message object. Each locale file is approximately 14-16 KiB raw. The client ICU parser and formatting runtime are also in the common bundle.

#### Recommended design

- Pass already translated labels into Client Components when runtime translation is unnecessary.
- Use nested providers with only the namespaces required by an interactive subtree.
- Set `messages={null}` at broader server-only boundaries where possible.
- Keep full client messages only for highly dynamic search/settings sections that genuinely need translation hooks.
- Measure HTML/RSC payload, common bundle, and INP before and after.

#### Acceptance criteria

- [ ] Privacy and other mostly server-rendered routes do not serialize all application messages.
- [ ] Missing-message errors do not occur during navigation or interaction.
- [ ] Locale switching remains correct.

### PERF-13: Redis rate limiter uses two or three round trips

- **Priority:** P2
- **Status:** OPEN
- **Evidence:** [`src/server/rate-limit.ts`](src/server/rate-limit.ts#L153)

#### Problem

The limiter performs `INCR`, conditionally `PEXPIRE`, and then `PTTL`. New keys require three Redis round trips and established keys require two. There is also an expiry race if the process disappears after `INCR` and before `PEXPIRE`.

#### Recommended design

- Replace the sequence with one portable Lua script.
- Atomically increment, assign the first expiry, and return count plus TTL.
- Preserve the in-memory fallback.
- Load the script once and use `EVALSHA`, with safe reload fallback if appropriate.

#### Acceptance criteria

- [ ] Normal Redis-backed rate checks require one round trip.
- [ ] Counters can never be left without an expiry.
- [ ] Rate-limit headers and behavior remain unchanged.
- [ ] Redis failures still fall back safely.

### PERF-14: Search timing underreports latency and lacks phase telemetry

- **Priority:** P2
- **Status:** OPEN
- **Evidence:** [`src/app/api/search/route.ts`](src/app/api/search/route.ts#L24)

#### Problem

Two translation namespaces are awaited before `startedAt` is assigned, so `requestDurationMs` excludes translation and request-configuration work. The single duration cannot explain whether latency comes from Redis, preferences, SearXNG, page replay, transformation, or response serialization.

#### Recommended design

- Start timing immediately on route entry.
- Parse and validate request parameters before success-only translation work where safe.
- Run independent work concurrently.
- Load error translations only on error paths if practical.
- Emit `Server-Timing` phases for rate limiting, preferences, each upstream page, transformation, and serialization.
- Record privacy-preserving histograms rather than raw search queries.

Metrics to add:

- `time_to_first_result`.
- Search p50/p95/p99 by tab.
- Upstream page count per UI page.
- Per-engine failures and `unresponsive_engines` counts.
- Client-aborted and timed-out upstream requests.
- Autocomplete requests per submitted query.
- Cache serialization duration and bytes.
- LCP and INP by route.

#### Acceptance criteria

- [ ] Reported server duration covers the complete route handler.
- [ ] Phase totals explain most of overall duration.
- [ ] Metrics contain no raw query text or sensitive preference values.
- [ ] Performance budgets can be enforced in CI or deployment checks.

### PERF-15: Video preview iframe loads on immediate hover or focus

- **Priority:** P2
- **Status:** OPEN
- **Evidence:** [`src/features/search/components/video-result-card.tsx`](src/features/search/components/video-result-card.tsx#L160)

#### Problem

The third-party iframe mounts immediately on pointer hover or focus and unmounts on leave. Accidental or repeated hover can repeatedly initialize a comparatively expensive player.

#### Recommended design

- Prefer click-to-play for the best performance and privacy behavior.
- If hover preview is retained, require 200-300 ms of pointer intent.
- Avoid repeated teardown/reload while the same card remains active.
- Keep the curated iframe sandbox.

#### Acceptance criteria

- [ ] Brief pointer movement does not request a video player.
- [ ] Keyboard users can intentionally activate the preview.
- [ ] Repeated interaction does not reload unnecessarily.

### PERF-16: Version indicator bypasses caching and retries indefinitely

- **Priority:** P3
- **Status:** OPEN
- **Evidence:** [`src/components/site/searxng-version-indicator.tsx`](src/components/site/searxng-version-indicator.tsx#L31), [`src/app/api/searxng/version/route.ts`](src/app/api/searxng/version/route.ts#L8), [`src/features/maintenance/server/searxng-update-status.ts`](src/features/maintenance/server/searxng-update-status.ts#L68)

#### Problem

The client uses `cache: "no-store"` even when the API returns `public, max-age=300, stale-while-revalidate=3600`. Unknown status retries every 15 seconds indefinitely.

The server already has useful six-hour success caching and pending-promise deduplication, so the main remaining waste is the client request pattern.

#### Recommended design

- Honor normal browser HTTP caching.
- Deduplicate status reads across client mounts.
- Defer the initial check until the footer is near view or the browser is idle.
- Use capped exponential backoff for unknown state.
- Keep the existing cleanup behavior.

#### Acceptance criteria

- [ ] Navigating between pages does not repeatedly bypass a fresh browser cache entry.
- [ ] Persistent registry failure does not cause four requests per minute per client indefinitely.
- [ ] The indicator remains accurate within its documented freshness window.

### PERF-17: Infinite-scroll has duplicate proximity mechanisms

- **Priority:** P3
- **Status:** OPEN
- **Evidence:** [`src/features/search/components/search-page-client.tsx`](src/features/search/components/search-page-client.tsx#L678)

#### Problem

The implementation uses IntersectionObserver plus scroll and resize listeners with `getBoundingClientRect`. It is throttled with `requestAnimationFrame` and cleaned up correctly, so impact is low.

#### Recommended design

- Use IntersectionObserver as the primary mechanism.
- Retain only a one-time initial proximity check if needed for short pages.
- Keep the current scroll fallback only for environments where IntersectionObserver is unavailable.

### PERF-18: Settings client component is monolithic

- **Priority:** P3
- **Status:** OPEN
- **Evidence:** [`src/features/settings/components/settings-page-preview.tsx`](src/features/settings/components/settings-page-preview.tsx)

#### Problem

The settings client component is approximately 1,262 lines. Rarely visited sections are compiled into the route and broad state changes can rerender a large subtree.

#### Recommended design

- Split settings by logical section.
- Dynamically load engine and advanced/special sections when opened if measurement justifies it.
- Keep state local to the smallest responsible section.
- Consider React Compiler annotation mode after establishing a render baseline.

### PERF-19: Minor repeated CPU work

- **Priority:** P3
- **Status:** OPEN

Candidate cleanups:

- Hoist the `commonTlds` set out of [`src/features/search/components/result-card.tsx`](src/features/search/components/result-card.tsx#L62).
- Cache parsed `SEARXNG_ENGINE_TOKENS` at module initialization rather than splitting the environment variable per request.
- Replace the 20-22 ms state interval in [`src/components/site/special-text.tsx`](src/components/site/special-text.tsx#L67) with a `requestAnimationFrame`-based implementation if profiling shows above-the-fold contention.
- Avoid recreating static filter option arrays and settings metadata during renders.
- Memoizing result cards will also prevent repeated URL/platform parsing for old results.

These changes should follow network, storage, and bundle work.

### PERF-20: Deployment and SearXNG configuration opportunities

- **Priority:** P3
- **Status:** OPEN
- **Evidence:** [`docker-compose.yml`](docker-compose.yml), [`Dockerfile`](Dockerfile), [`searxng/core-config/settings.yml`](searxng/core-config/settings.yml), [`docker/caddy/Caddyfile`](docker/caddy/Caddyfile)

#### Findings

- `pull_policy: always` can slow restarts by forcing registry checks or pulls. This is a deployment-speed tradeoff, not request latency.
- SearXNG inherits outgoing defaults because no explicit `outgoing` block is configured.
- The observed logs included DuckDuckGo CAPTCHA exceptions.
- SearXNG already suspends CAPTCHA-failing engines, normally for a day, so a second application-level circuit breaker would duplicate existing behavior.

#### Recommended design

- Collect per-engine latency and `unresponsive_engines` data before changing engine selection.
- Disable only engines consistently blocked from this deployment.
- Set engine-specific timeouts based on observed p95 latency and result-quality impact.
- Increase connection pool limits only when concurrent testing shows pool contention.
- Consider a pinned deployment image and explicit update workflow if predictable/faster restarts are more important than automatic pulls.
- Do not globally reduce timeouts or engine count without measuring search-quality loss.

## Implementation phases

### Phase 0: Establish measurement guardrails

- [ ] Correct complete-route timing.
- [ ] Add `Server-Timing` phases.
- [ ] Track upstream request/page counts without query text.
- [ ] Add time-to-first-result, LCP, and INP measurement.
- [ ] Save a bundle-analyzer baseline for later diffs.

### Phase 1: Search critical path

- [x] Implement continuation or short-lived upstream-page caching.
- [ ] Start initial search server-side and stream results.
- [ ] Use client-side form navigation with native fallback.
- [ ] Propagate request abort signals to all upstream work.
- [ ] Debounce, focus-gate, cache, and deduplicate autocomplete.

### Phase 2: Main-thread and result-list work

- [ ] Disable result-cache writes in fresh mode.
- [ ] Make cache-mode persistence incremental and idle.
- [ ] Gate mathjs behind an expression heuristic.
- [ ] Add result-card visibility containment and memoization.
- [ ] Simplify infinite-scroll detection if profiling supports it.

### Phase 3: Media and shared JavaScript

- [ ] Fix favicon delivery and add bounded caching.
- [ ] Preload only one logo.
- [ ] Move Sonner out of the root layout.
- [ ] Replace or isolate the two-option Radix Select.
- [ ] Simplify the global tooltip dependency.
- [ ] Add click/intent gating to video previews.

### Phase 4: Rendering and state architecture

- [ ] Split and scope preference cookies/state.
- [ ] Make privacy/static content publicly cacheable.
- [ ] Deduplicate preference reads.
- [ ] Limit next-intl messages by route/subtree.
- [ ] Split the settings client component.
- [ ] Evaluate React Compiler with before/after render measurements.

### Phase 5: Infrastructure refinements

- [ ] Replace the Redis limiter sequence with one atomic script.
- [ ] Tune SearXNG engines/timeouts only from production evidence.
- [ ] Revisit image and deployment policies after user-facing work is complete.

## Validation matrix

| Scenario | Required checks |
| --- | --- |
| Cold direct search | Time to first result, search-specific JS, duplicate API calls, streamed shell |
| Home to search | Client navigation, preserved hydration, one initial search request |
| Search to search | No full document reload, stale request aborted upstream |
| Load more to page 12 | Upstream page counts, result ordering, dedupe, memory, scroll responsiveness |
| Direct `?page=12` | No nested page replay; cursor validation |
| Rapid tab/filter changes | Upstream aborts, no stale state, accurate errors |
| Typing and deleting quickly | Debounce count, in-flight dedupe, focus behavior, accessibility |
| Fresh result mode | Zero session-storage writes |
| Cache result mode | Bounded storage, idle persistence, correct restoration |
| Ordinary text query | No mathjs chunk request |
| Calculator query | Correct result and on-demand chunk load |
| Long web/video/image lists | Render counts, INP, scroll, focus, browser find |
| Light/dark/system theme | One initial logo request, no flash, correct switching |
| Favicon-heavy result page | No image-optimizer 400s, cache reuse, bounded provider calls |
| Privacy page | Static/public cacheability and correct locale/theme behavior |
| Redis unavailable | Safe memory fallback and no request failure |
| SearXNG engine failure | Bounded timeout, suspension behavior, useful results from healthy engines |

## Performance budgets to establish

These should be finalized from production data rather than imposed blindly:

- Search time-to-first-result p50/p95 by tab.
- Maximum upstream SearXNG pages per UI page.
- Autocomplete requests per submitted query.
- Client-aborted upstream completion rate.
- Common-route compressed JavaScript.
- Search incremental JavaScript from home.
- LCP on home and direct search.
- INP during autocomplete, load-more, and settings changes.
- Maximum result-cache bytes and write duration.
- Maximum favicon provider calls per result page.

## Confirmed healthy or intentionally unchanged

The following were inspected and should not be filed as performance bugs without new evidence:

### Parallel video requests

The video JSON request and HTML engine-data request already run with `Promise.all`. They double backend query volume, but they do not create a sequential-await waterfall. A future SearXNG/API extension that returns engine continuation data with JSON could halve video request volume, but the current Next.js code is already concurrent.

### Arbitrary third-party result images

Native lazy `<img>` elements are appropriate for unbounded external result thumbnails. Routing all of them through `next/image` would require unsafe broad allowlisting or proxying and would shift external bandwidth/CPU onto the application server. Existing React Doctor suppressions for these cases are legitimate.

### Radix package import shape

The `radix-ui` umbrella imports are tree-shaken into the individual used packages. The real opportunity is whether the Select or Tooltip component is needed, not mechanically rewriting the import path.

### Framer Motion

The used `useInView` functionality is heavily tree-shaken and contributes only roughly 1.2 KiB Brotli. Removing the dependency is not a priority.

### Transformation passes

The server transformation layer processes tens of results per response. Combining small maps/filters or micro-optimizing string reads will not materially compete with 700-950 ms upstream searches.

### Runtime choice

Node.js is appropriate for ioredis, Buffer usage, and this self-hosted topology. Moving to Edge would not fix repeated SearXNG work and would complicate current dependencies.

### Search-result caching policy

Do not globally cache user searches without respecting the explicit freshness setting and query-privacy expectations. Any short-lived server cache must use bounded TTLs, non-plaintext keys, and documented privacy behavior.

### Existing deployment fundamentals

These are already good:

- Next.js standalone output.
- Multi-stage Docker build and non-root runtime user.
- Caddy zstd/gzip compression.
- Local Valkey for low-latency distributed rate limiting.
- Read-only containers and bounded memory/PID settings.
- Cheap health endpoint and service health checks.
- SearXNG/Valkey/Next.js separation.

### Effect cleanup

The SearXNG version indicator's timer and abort controller are cleaned up correctly. Its remaining issue is cache/retry policy, not a resource leak.

## Official references

- [Next.js package bundling and analyzer](https://nextjs.org/docs/pages/guides/package-bundling)
- [Next.js `cookies()` dynamic rendering behavior](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [Next.js Image local pattern rules](https://nextjs.org/docs/messages/next-image-unconfigured-localpatterns)
- [Next.js React Compiler configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler)
- [React `cache`](https://react.dev/reference/react/cache)
- [React `memo`](https://react.dev/reference/react/memo)
- [Node.js `AbortSignal.any`](https://nodejs.org/api/globals.html#static-method-abortsignalanysignals)
- [Redis pipelining](https://redis.io/docs/latest/develop/using-commands/pipelining/)
- [Redis rate-limiter guidance](https://redis.io/docs/latest/develop/use-cases/rate-limiter/)
- [next-intl Server and Client Component performance](https://next-intl.dev/docs/environments/server-client-components)
- [SearXNG outgoing request configuration](https://docs.searxng.org/admin/settings/settings_outgoing.html)
- [SearXNG engine configuration](https://docs.searxng.org/admin/settings/settings_engines.html)
- [SearXNG exception and suspension behavior](https://docs.searxng.org/src/searx.exceptions.html)

## Change log

| Date | Change |
| --- | --- |
| 2026-07-31 | Initial audit and implementation tracker created. |
| 2026-07-31 | Completed PERF-01 with bounded Valkey-backed continuations, linear recovery, video overflow preservation, and pagination regression tests. |
| 2026-08-01 | Fixed the client-facing portion of PERF-08 by bypassing image transformation for tiny query-bearing favicon URLs; shared provider caching remains open. |
| 2026-08-01 | Completed PERF-03 by propagating client cancellation to search, autocomplete, and favicon upstream requests while preserving endpoint timeout behavior. |
| 2026-08-01 | Completed PERF-04 with focus-aware debounce, bounded memory caching, shared in-flight autocomplete requests, and a focused component extraction. |
