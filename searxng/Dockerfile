# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:c7ca5516d881de86f34ea65fcb4231eb1b2d0837f95abe6cd035764e051eb575
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
