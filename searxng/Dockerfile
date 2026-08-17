# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:e45d5894bfaa0bf8773b9f283795ae57f1c15ddb29c8cecb70b3665b0ce9ec60
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
