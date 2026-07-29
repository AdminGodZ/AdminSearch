# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:5d6d903ab82afa56ee32792d477f36bc63d3e5ca04fcb6947e28a5cfd987fad3
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
