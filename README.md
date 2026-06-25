<div align="center">
  <h1>AdminSearch</h1>
  <p>
    AdminSearch is a self-hosted search frontend built with Next.js and backed
    by a private SearXNG instance. The browser talks to AdminSearch,
    AdminSearch talks to SearXNG, and the SearXNG backend handles the upstream
    search engines.
  </p>
  <p>
    The project focuses on a clean search experience with privacy-oriented
    defaults, server-side request handling, configurable engines, autocomplete,
    result tabs, theme support, and a Docker-based production setup.
  </p>
  <p>
    <img src="./public/AdminSearch_Home_light.png" alt="AdminSearch home page in light mode" width="49%" />
    <img src="./public/AdminSearch_Home_dark.png" alt="AdminSearch home page in dark mode" width="49%" />
  </p>
</div>

## Features

- <img src="https://api.iconify.design/lucide:layout-list.svg?color=%23ffffff" alt="" width="18" />  Search tabs for web, images, videos, and news
- <img src="https://api.iconify.design/lucide:sparkles.svg?color=%23ffffff" alt="" width="18" />  Autocomplete through the configured SearXNG backend
- <img src="https://api.iconify.design/lucide:sliders-horizontal.svg?color=%23ffffff" alt="" width="18" />  Settings for engines, language, theme, privacy, result behavior, and plugins
- <img src="https://api.iconify.design/lucide:server-cog.svg?color=%23ffffff" alt="" width="18" />  Server-side search proxying and response normalization
- <img src="https://api.iconify.design/lucide:shield-check.svg?color=%23ffffff" alt="" width="18" />  Redis/Valkey-backed rate limiting in production
- <img src="https://api.iconify.design/lucide:refresh-cw.svg?color=%23ffffff" alt="" width="18" />  SearXNG version visibility with upstream status checks
- <img src="https://api.iconify.design/lucide:moon-star.svg?color=%23ffffff" alt="" width="18" />  Light and dark themes via `next-themes` (with more coming)
- <img src="https://api.iconify.design/lucide:container.svg?color=%23ffffff" alt="" width="18" />  Docker Compose stack for Next.js, SearXNG, Valkey, and Caddy

## Stack

- <img src="https://cdn.simpleicons.org/nextdotjs/white" alt="" width="18" />  Next.js 16 App Router
- <img src="https://cdn.simpleicons.org/react/61DAFB" alt="" width="18" />  React 19
- <img src="https://cdn.simpleicons.org/typescript/3178C6" alt="" width="18" />  TypeScript
- <img src="https://cdn.simpleicons.org/tailwindcss/06B6D4" alt="" width="18" />  Tailwind CSS 4
- <img src="https://cdn.simpleicons.org/shadcnui/white" alt="" width="18" />  shadcn/ui
- <img src="https://cdn.simpleicons.org/radixui/white" alt="" width="18" />  Radix UI
- <img src="https://cdn.simpleicons.org/biome/60A5FA" alt="" width="18" />  Biome
- <img src="https://cdn.simpleicons.org/searxng/3050FF" alt="" width="18" />  SearXNG
- <img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/valkey.svg" alt="" width="18" />  Valkey
- <img src="https://cdn.simpleicons.org/caddy/1F88C0" alt="" width="18" />  Caddy

## Requirements

- Node.js compatible with Next.js 16
- npm
- Docker and Docker Compose
- A SearXNG image reference for the Compose stack
- A Valkey image reference for the Compose stack

## Getting Started

Install dependencies:

```bash
npm install
```

Create local environment files:

```bash
cp .env.example .env.local
```

For local development, either point `SEARXNG_INTERNAL_URL` at an existing
SearXNG instance or start the local backend services:

```bash
docker compose up -d searxng-core valkey
```

Start the Next.js dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment

The most important values are:

```text
NEXT_PUBLIC_APP_URL=http://localhost:3000
SEARXNG_INTERNAL_URL=http://127.0.0.1:8080
RATE_LIMIT_REDIS_URL=
SEARXNG_ENGINE_TOKENS=
SEARXNG_IMAGE=docker.io/searxng/searxng:latest
VALKEY_IMAGE=docker.io/valkey/valkey:8-alpine
SEARXNG_SECRET=
```

For production, choose the image tags or digest-pinned image references and set a
generated `SEARXNG_SECRET`.
`RATE_LIMIT_REDIS_URL` should point to Valkey/Redis so rate limiting is shared
across server instances.

Forwarded proxy headers for rate limiting should only be trusted when the app is
behind a known reverse proxy. The Compose stack is built for the
Cloudflare-to-Caddy-to-Next.js path and enables that behavior there. When
present, AdminSearch prefers Cloudflare's visitor IP headers for rate-limit keys.

## Scripts

```bash
npm run dev      # start the local Next.js dev server
npm run build    # create a production build
npm run start    # run the production server
npm run lint     # run Biome checks
npm run format   # format the codebase
```

## Production

The Compose stack runs:

- Next.js
- SearXNG
- Valkey
- Caddy

Start the standalone stack with:

```bash
docker compose up -d --build
```

Before deploying, review `.env.example`, choose your image references, and
generate a strong `SEARXNG_SECRET`.

Update the service images with:

```bash
docker compose pull
docker compose up -d
```

This standalone mode does not require a Cloudflare container or an external
Docker network. By default it binds Caddy to `127.0.0.1:80`; set
`PUBLIC_BIND_ADDRESS=0.0.0.0` only if you intentionally want the host port
reachable from outside the server.

For a Cloudflare Tunnel setup where `cloudflared` runs as a separate container,
create the shared Docker network once:

```bash
docker network create proxy
```

Then start the stack with the Cloudflare override:

```bash
docker compose -f docker-compose.yml -f docker-compose.cloudflare.yml up -d --build
```

Leave `APP_DOMAIN=:8080`, `PUBLIC_BIND_ADDRESS=127.0.0.1`, and
`PROXY_NETWORK=proxy`. The override attaches Caddy to that external network as
`adminsearch-caddy`, so the tunnel can use `http://adminsearch-caddy:8080` as
the origin for `search.admingod.ch`. The loopback host port remains available
for local checks at `http://127.0.0.1:80` without exposing the app directly on
the server's public interfaces.

## Railway

Railway should be treated as a separate service topology, not as a direct copy
of the local Compose stack. Railway does not run this `docker-compose.yml` as
one container group; model each runtime as its own Railway service.

Use this split:

- `adminsearch`: deploy this repository from GitHub. Railway will use the root
  `Dockerfile`, which builds the Next.js standalone server.
- `searxng-core`: deploy this same repository as a second service with the
  Dockerfile path set to `/searxng/Dockerfile` and the root directory left at
  `/`. This packages the checked-in `searxng/core-config` files into the SearXNG
  image.
- Redis: add Railway's managed Redis service and reference its `REDIS_URL` from
  the `adminsearch` service.

Do not deploy the Caddy service on Railway. Railway's public networking,
domains, TLS, and edge proxy replace the local Caddy reverse proxy. The
`docker/caddy/Caddyfile`, `docker-compose.cloudflare.yml`, `APP_DOMAIN`,
`PUBLIC_BIND_ADDRESS`, `PUBLIC_HTTP_PORT`, and `PROXY_NETWORK` settings are only
for the local/server Compose path.

Set these variables on the `adminsearch` service:

```text
NEXT_PUBLIC_APP_URL=https://<your-railway-or-custom-domain>
SEARXNG_INTERNAL_URL=http://searxng-core.railway.internal:8080
RATE_LIMIT_REDIS_URL=${{Redis.REDIS_URL}}
SEARXNG_IMAGE=docker.io/searxng/searxng:latest
SEARXNG_ENGINE_TOKENS=
SEARXNG_UPDATE_CHECK_TTL_MS=21600000
SEARXNG_UPDATE_CHECK_TIMEOUT_MS=5000
RATE_LIMIT_TRUST_PROXY_HEADERS=true
RATE_LIMIT_TRUSTED_PROXY_HOPS=1
SEARCH_RATE_LIMIT_WINDOW_MS=60000
SEARCH_RATE_LIMIT_MAX=30
AUTOCOMPLETE_RATE_LIMIT_WINDOW_MS=60000
AUTOCOMPLETE_RATE_LIMIT_MAX=600
```

Replace `Redis` in the `RATE_LIMIT_REDIS_URL` reference if Railway names the
managed Redis service differently.

Set these variables on the `searxng-core` service:

```text
SEARXNG_SECRET=<generated-random-secret>
SEARXNG_PORT=8080
SEARXNG_BIND_ADDRESS=::
SEARXNG_IMAGE=docker.io/searxng/searxng:latest
```

Only generate a public Railway domain for `adminsearch`. Keep `searxng-core`
private, reachable through `http://searxng-core.railway.internal:8080`.

## Privacy

AdminSearch is designed to keep browser traffic pointed at your own frontend.
Search requests are handled server-side and forwarded to your private SearXNG
backend. Self-hosted instances can therefore keep search behavior under the
operator's control, depending on how the backend and upstream engines are
configured.
