#!/bin/sh
set -e

: "${RANCHER_URL:?RANCHER_URL is required (e.g. https://rancher.example.com)}"

# Substitute only RANCHER_URL — leave nginx's own $variables untouched
envsubst '${RANCHER_URL}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
