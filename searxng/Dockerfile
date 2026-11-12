# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:0b104e2e1117b0ca83a36f3ac6ecda7d9ee948ccea6ead74750a03e1b856229a
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng
COPY --chmod=755 searxng/render-proxy-settings.py /usr/local/bin/adminsearch-render-searxng-settings
COPY --chmod=755 searxng/entrypoint.sh /usr/local/bin/adminsearch-searxng-entrypoint

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/adminsearch-searxng-entrypoint"]
