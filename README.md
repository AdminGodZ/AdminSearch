<div align="center">
  <h1>AdminSearch</h1>
  <p>
    A self-hosted search frontend built with Next.js and backed by a private
    SearXNG instance.
  </p>
  <p>
    <img src="./public/AdminSearch_Home_light.png" alt="AdminSearch home page in light mode" width="49%" />
    <img src="./public/AdminSearch_Home_dark.png" alt="AdminSearch home page in dark mode" width="49%" />
  </p>
</div>

## Features

- Web, image, video, and news search
- Configurable engines, language, privacy, and result behavior
- English and German interface localization
- Server-side SearXNG proxying
- Redis/Valkey-backed rate limiting
- Light, dark, and system appearance modes with
  [tracked named themes](./THEMES.md)
- Docker Compose setup for self-hosting
- Separate Docker images for Railway and similar platforms

## Stack

- <img src="https://cdn.simpleicons.org/nextdotjs/white" alt="" width="18" /> Next.js 16
- next-intl 4
- <img src="https://cdn.simpleicons.org/react/61DAFB" alt="" width="18" /> React 19
- <img src="https://cdn.simpleicons.org/typescript/3178C6" alt="" width="18" /> TypeScript 7
- <img src="https://cdn.simpleicons.org/tailwindcss/06B6D4" alt="" width="18" /> Tailwind CSS
- <img src="https://cdn.simpleicons.org/shadcnui/white" alt="" width="18" /> shadcn/ui
- <img src="https://cdn.simpleicons.org/searxng/3050FF" alt="" width="18" /> SearXNG
- <img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/valkey.svg" alt="" width="18" /> Valkey
- <img src="https://cdn.simpleicons.org/caddy/1F88C0" alt="" width="18" /> Caddy

## Local development

Requirements:

- Node.js 22 and npm
- Docker and Docker Compose

Install the dependencies and create the environment file:

```bash
npm install
cp .env.example .env
```

Generate a secret with `openssl rand -hex 32` and assign it to
`SEARXNG_SECRET` in `.env`.

Start SearXNG and Valkey:

```bash
docker compose up -d searxng-core valkey
```

Start AdminSearch:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Configuration

The main environment variables are:

```text
NEXT_PUBLIC_APP_URL=http://localhost:3000
SEARXNG_INTERNAL_URL=http://127.0.0.1:8080
RATE_LIMIT_REDIS_URL=
VALKEY_IMAGE=docker.io/valkey/valkey:latest
SEARXNG_SECRET=
```

See `.env.example` for all available settings. SearXNG always uses and pulls
`docker.io/searxng/searxng:latest` whenever the Compose stack starts; the
SearXNG production Dockerfile uses the same unpinned image.

## Self-hosting

Set `NEXT_PUBLIC_APP_URL` and `SEARXNG_SECRET` in `.env`, then run:

```bash
docker compose up -d --build
```

The stack includes AdminSearch, SearXNG, Valkey, and Caddy. Caddy binds to
`127.0.0.1:80` by default. Set `PUBLIC_BIND_ADDRESS=0.0.0.0` only when the host
port should be reachable from outside the server.

Update the service images with:

```bash
docker compose pull
docker compose up -d
```

## Railway

Create three services in one Railway project:

- `adminsearch`: this repository using the root `Dockerfile`
- `searxng-core`: this repository using `/searxng/Dockerfile`
- Redis: Railway's managed Redis service

Configure `adminsearch`:

```text
NEXT_PUBLIC_APP_URL=https://<your-domain>
SEARXNG_INTERNAL_URL=http://searxng-core.railway.internal:8080
RATE_LIMIT_REDIS_URL=${{Redis.REDIS_URL}}
RATE_LIMIT_TRUST_PROXY_HEADERS=true
RATE_LIMIT_TRUSTED_PROXY_HOPS=1
```

Set `NEXT_PUBLIC_APP_URL` before the image is built because Next.js embeds it
during the production build. Replace `Redis` in the reference if the managed
service has a different name.

Configure `searxng-core`:

```text
SEARXNG_SECRET=<generated-random-secret>
SEARXNG_PORT=8080
SEARXNG_BIND_ADDRESS=::
```

Only generate a public domain for `adminsearch`. Keep `searxng-core` and Redis
private. Caddy is only used by the self-hosted Compose stack.

## Scripts

```bash
npm run dev
npm run typecheck
npm run build
npm run start
npm run lint
npm run format
```

## Privacy

Browser search requests go through AdminSearch to the configured private
SearXNG backend. AdminSearch does not require user accounts, tracking profiles,
or client-side analytics.
