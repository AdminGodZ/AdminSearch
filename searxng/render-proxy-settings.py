#!/usr/bin/env python3
"""Render SearXNG settings with an optional validated outbound proxy pool."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys
import tempfile
from urllib.parse import urlsplit


ALLOWED_PROXY_SCHEMES = {"http", "https", "socks5", "socks5h"}
MAX_PROXY_COUNT = 32
MAX_PROXY_URL_LENGTH = 2_048
MAX_PROXY_ENV_LENGTH = 65_536


class ProxyConfigurationError(ValueError):
    """Raised for invalid proxy settings without echoing credential-bearing URLs."""


def parse_proxy_urls(raw_value: str) -> list[str]:
    if len(raw_value) > MAX_PROXY_ENV_LENGTH:
        raise ProxyConfigurationError("the proxy list is too large")

    proxies: list[str] = []
    seen: set[str] = set()

    for line_number, raw_line in enumerate(raw_value.splitlines(), start=1):
        proxy_url = raw_line.strip()

        if not proxy_url or proxy_url.startswith("#"):
            continue

        if len(proxy_url) > MAX_PROXY_URL_LENGTH:
            raise ProxyConfigurationError(
                f"proxy entry {line_number} exceeds the length limit"
            )

        if any(character.isspace() for character in proxy_url):
            raise ProxyConfigurationError(
                f"proxy entry {line_number} contains whitespace"
            )

        try:
            parsed = urlsplit(proxy_url)
            parsed.port
        except ValueError as error:
            raise ProxyConfigurationError(
                f"proxy entry {line_number} has an invalid port"
            ) from error

        if parsed.scheme.lower() not in ALLOWED_PROXY_SCHEMES:
            raise ProxyConfigurationError(
                f"proxy entry {line_number} uses an unsupported scheme"
            )

        if not parsed.hostname:
            raise ProxyConfigurationError(
                f"proxy entry {line_number} does not include a hostname"
            )

        if parsed.query or parsed.fragment or parsed.path not in ("", "/"):
            raise ProxyConfigurationError(
                f"proxy entry {line_number} must not include a path, query, or fragment"
            )

        if proxy_url in seen:
            continue

        seen.add(proxy_url)
        proxies.append(proxy_url)

        if len(proxies) > MAX_PROXY_COUNT:
            raise ProxyConfigurationError(
                f"the proxy list supports at most {MAX_PROXY_COUNT} entries"
            )

    return proxies


def read_retries(raw_value: str) -> int:
    try:
        retries = int(raw_value)
    except ValueError as error:
        raise ProxyConfigurationError("outgoing retries must be an integer") from error

    if retries < 0 or retries > 5:
        raise ProxyConfigurationError("outgoing retries must be between 0 and 5")

    return retries


def read_extra_proxy_timeout(raw_value: str) -> int:
    try:
        timeout = int(raw_value)
    except ValueError as error:
        raise ProxyConfigurationError(
            "extra proxy timeout must be an integer"
        ) from error

    if timeout < 0 or timeout > 60:
        raise ProxyConfigurationError(
            "extra proxy timeout must be between 0 and 60 seconds"
        )

    return timeout


def render_settings(
    source_path: Path,
    target_path: Path,
    proxies: list[str],
    retries: int,
    extra_proxy_timeout: int,
) -> None:
    try:
        import yaml
    except ImportError as error:
        raise ProxyConfigurationError(
            "the SearXNG runtime does not provide its YAML parser"
        ) from error

    try:
        settings = yaml.safe_load(source_path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as error:
        raise ProxyConfigurationError("the base settings file could not be read") from error

    if not isinstance(settings, dict):
        raise ProxyConfigurationError("the base settings file is not a YAML mapping")

    if proxies:
        outgoing = settings.setdefault("outgoing", {})

        if not isinstance(outgoing, dict):
            raise ProxyConfigurationError("the existing outgoing settings are invalid")

        outgoing["proxies"] = {"all://": proxies}
        outgoing["retries"] = retries
        outgoing["extra_proxy_timeout"] = extra_proxy_timeout

    target_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with tempfile.NamedTemporaryFile(
            "w",
            dir=target_path.parent,
            encoding="utf-8",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            yaml.safe_dump(
                settings,
                temporary_file,
                allow_unicode=True,
                sort_keys=False,
            )

        temporary_path.chmod(0o600)
        temporary_path.replace(target_path)
    except (OSError, yaml.YAMLError) as error:
        raise ProxyConfigurationError("the runtime settings could not be written") from error


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--target", type=Path)
    parser.add_argument("--validate-only", action="store_true")
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()

    try:
        proxies = parse_proxy_urls(os.environ.get("SEARXNG_OUTGOING_PROXY_URLS", ""))
        retries = read_retries(os.environ.get("SEARXNG_OUTGOING_RETRIES", "1"))
        extra_proxy_timeout = read_extra_proxy_timeout(
            os.environ.get("SEARXNG_OUTGOING_EXTRA_PROXY_TIMEOUT", "10")
        )

        if arguments.validate_only:
            print(f"Validated {len(proxies)} outbound proxy entries.")
            return 0

        if arguments.source is None or arguments.target is None:
            raise ProxyConfigurationError(
                "source and target settings paths are required"
            )

        render_settings(
            arguments.source,
            arguments.target,
            proxies,
            retries,
            extra_proxy_timeout,
        )
    except ProxyConfigurationError as error:
        print(f"SearXNG proxy configuration error: {error}", file=sys.stderr)
        return 2

    if proxies:
        print(f"Configured {len(proxies)} outbound proxies.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
