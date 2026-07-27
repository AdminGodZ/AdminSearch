# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:d0aaeb14880e6e92bde1518fcc7261e995783367d63d95203383607bef9c6516
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
