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

<p>
  <img src="https://cdn.simpleicons.org/nextdotjs/white" alt="Next.js" width="38" height="38" />
  <img src="https://cdn.simpleicons.org/react/61DAFB" alt="React" width="38" height="38" />
  <img src="https://cdn.simpleicons.org/typescript/3178C6" alt="TypeScript" width="38" height="38" />
  <img src="https://cdn.simpleicons.org/tailwindcss/06B6D4" alt="Tailwind CSS" width="38" height="38" />
  <img src="https://cdn.simpleicons.org/shadcnui/white" alt="shadcn/ui" width="38" height="38" />
  <img src="https://cdn.simpleicons.org/radixui/white" alt="Radix UI" width="38" height="38" />
  <img src="https://cdn.simpleicons.org/biome/60A5FA" alt="Biome" width="38" height="38" />
  <img src="https://cdn.simpleicons.org/searxng/3050FF" alt="SearXNG" width="38" height="38" />
  <img src="https://cdn.simpleicons.org/valkey/FF4438" alt="Valkey" width="38" height="38" />
  <img src="https://cdn.simpleicons.org/caddy/1F88C0" alt="Caddy" width="38" height="38" />
</p>

Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Radix UI, Biome,
SearXNG, Valkey, and Caddy.

## Requirements

- Node.js compatible with Next.js 16
- npm
- Docker and Docker Compose
- A pinned SearXNG image digest for the Compose stack
- A pinned Valkey image digest for the Compose stack

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
SEARXNG_IMAGE_DIGEST=
VALKEY_IMAGE_DIGEST=
SEARXNG_SECRET=
```

For production, set the image digests and a generated `SEARXNG_SECRET`.
`RATE_LIMIT_REDIS_URL` should point to Valkey/Redis so rate limiting is shared
across server instances.

Forwarded proxy headers for rate limiting should only be trusted when the app is
behind a known reverse proxy. The Compose production stack is built for the
Caddy-to-Next.js path and enables that behavior there.

## Scripts

```bash
npm run dev      # start the local Next.js dev server
npm run build    # create a production build
npm run start    # run the production server
npm run lint     # run Biome checks
npm run format   # format the codebase
```

## Production

The production profile runs:

- Next.js
- SearXNG
- Valkey
- Caddy

Start it with:

```bash
docker compose --profile prod up -d --build
```

Before deploying, review `.env.example`, pin the image digests, set your domain,
and generate a strong `SEARXNG_SECRET`.

## Privacy

AdminSearch is designed to keep browser traffic pointed at your own frontend.
Search requests are handled server-side and forwarded to your private SearXNG
backend. Self-hosted instances can therefore keep search behavior under the
operator's control, depending on how the backend and upstream engines are
configured.
