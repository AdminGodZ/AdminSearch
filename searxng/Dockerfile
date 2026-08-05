# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:f4c8e59de166ed71f6380c0847c312ca51f0d41996e31d0559163b6b09ecde52
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
