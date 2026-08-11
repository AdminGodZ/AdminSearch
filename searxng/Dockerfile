# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:cd22dbf7fac8b25d5e39e65af53a4b47009df5ad3162e270c477fd5b30ce03f2
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
