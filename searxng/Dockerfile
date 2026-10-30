# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:f1bbc31c7bef7a7d8dd2b105c8397eb7dea1eeb7eceebdd45c0c29aef38c0c91
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng
COPY --chmod=755 searxng/render-proxy-settings.py /usr/local/bin/adminsearch-render-searxng-settings
COPY --chmod=755 searxng/entrypoint.sh /usr/local/bin/adminsearch-searxng-entrypoint

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/adminsearch-searxng-entrypoint"]
