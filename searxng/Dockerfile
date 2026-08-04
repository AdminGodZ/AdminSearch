# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:77a4f1013b9e2ba857b360dcfea68bc10b3cc5f63572f3d7861cc323cba22c16
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
