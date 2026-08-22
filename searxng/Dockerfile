# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:bbd44b09b83e4ea8b8ab80953e5eed24837ff02d00fc752bd1762b9fc244eaa9
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
