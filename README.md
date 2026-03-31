# AdminSearch

AdminSearch is a public Next.js search frontend backed by a private SearXNG
instance. The browser only talks to `GET /api/search`; Next.js handles
validation, rate limiting, and normalization before it calls SearXNG.

## Stack

- Next.js 16 App Router with TypeScript
- Tailwind CSS 4
- Biome for formatting and linting
- SearXNG as the private metasearch backend
- Valkey for request rate limiting
- Caddy for the production reverse proxy

## Local development

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Start the backend services:

```bash
docker compose up -d searxng-core valkey
```

4. Start the frontend:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`. SearXNG stays private on
`http://127.0.0.1:8080`, and Valkey stays private on `127.0.0.1:6379`.

## Production stack

Set your production values in `.env`, especially:

- `APP_DOMAIN`
- `NEXT_PUBLIC_APP_URL`
- `SEARXNG_SECRET`

Then start the full stack:

```bash
docker compose --profile prod up -d --build
```

This runs:

- `nextjs`
- `searxng-core`
- `valkey`
- `caddy`

## Useful commands

```bash
npm run format
npm run lint
npm run build
```

## Search API

The frontend uses a single internal endpoint:

```txt
GET /api/search?q=nextjs&tab=all&page=1&safeSearch=0
```

Supported query params:

- `q`: required
- `tab`: `all | images`
- `page`: positive integer
- `language`: optional language code
- `timeRange`: `day | month | year`
- `safeSearch`: `0 | 1 | 2`

## Notes

- SearXNG JSON output is enabled in `searxng/core-config/settings.yml`
- The MVP renders image thumbnails directly from remote hosts
- Rate limiting falls back to in-memory storage if Valkey is unavailable
