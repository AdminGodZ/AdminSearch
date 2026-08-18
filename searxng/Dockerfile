# Build trigger only: this tracks the digest behind :latest without pinning it.
# SearXNG latest digest: sha256:3aed6b4bfb4e6a2b3b94c890dafb3f35cb2588493b83818434aa260e8bdeb4d4
FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=::

COPY searxng/core-config /etc/searxng

EXPOSE 8080
