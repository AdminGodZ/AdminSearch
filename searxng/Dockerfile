# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:f9d1250cca864c93d8831fe0e5e686f3999922cc9abe76a86bb8d1aa4e050877
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
