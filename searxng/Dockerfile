# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:3bc6ae0e872ecd4b003e97e9cb58ec0fb56b02d46ad97ea67e2fa4ff2e8ff759
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
