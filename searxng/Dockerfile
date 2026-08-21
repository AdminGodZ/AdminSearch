# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:1808478ceb295bdb87e70f069e3d4ef1a0abd318e2a10d550f0a31fc839a745d
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
