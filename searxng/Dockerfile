# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:37baac8380e1a31e022b8dda0c58dbd6ba0630e3fdaf2c522bda3d140f5ef111
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
