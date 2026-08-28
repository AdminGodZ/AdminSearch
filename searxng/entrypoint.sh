#!/bin/sh
set -eu

runtime_config_dir=/tmp/adminsearch-searxng
runtime_settings_path=$runtime_config_dir/settings.yml

mkdir -p "$runtime_config_dir"
cp -R /etc/searxng/. "$runtime_config_dir/"

/usr/local/searxng/.venv/bin/python \
  /usr/local/bin/adminsearch-render-searxng-settings \
  --source /etc/searxng/settings.yml \
  --target "$runtime_settings_path"

export SEARXNG_SETTINGS_PATH="$runtime_settings_path"

exec /usr/local/searxng/entrypoint.sh "$@"
