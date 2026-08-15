# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:892cf809341915a4b7710d3c9045005b4c377d51335a089b6d4da0b28750788d
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
