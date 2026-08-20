# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:2344ab06b942db1dd6f73ba7f443c8672c6f0c543dac77415c6fd4696cbfe045
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
