# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:a07a5cd2da2c63d66e559f9e4d3a3db106cfc6c32fb0ac70abe91cc28bcd7350
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng
COPY --chmod=755 searxng/render-proxy-settings.py /usr/local/bin/adminsearch-render-searxng-settings
COPY --chmod=755 searxng/entrypoint.sh /usr/local/bin/adminsearch-searxng-entrypoint

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/adminsearch-searxng-entrypoint"]
