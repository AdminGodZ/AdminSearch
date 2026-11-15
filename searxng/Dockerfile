# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:eb8b09ffa83aebbe8b8d3ded23cfd224b2d3b01db4f3af9eb03876ef6def6dda
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng
COPY --chmod=755 searxng/render-proxy-settings.py /usr/local/bin/adminsearch-render-searxng-settings
COPY --chmod=755 searxng/entrypoint.sh /usr/local/bin/adminsearch-searxng-entrypoint

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/adminsearch-searxng-entrypoint"]
