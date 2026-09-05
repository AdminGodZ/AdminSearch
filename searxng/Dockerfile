# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:8bb6a6f677a758cefa4ae2c9f5da1012876e428a4388e3e86f34be4ca715330a
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng
COPY --chmod=755 searxng/render-proxy-settings.py /usr/local/bin/adminsearch-render-searxng-settings
COPY --chmod=755 searxng/entrypoint.sh /usr/local/bin/adminsearch-searxng-entrypoint

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/adminsearch-searxng-entrypoint"]
