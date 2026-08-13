# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:c2dc2d9e6b910653e8628361c23443222490e4cabbb9e02667b7847143db843b
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
