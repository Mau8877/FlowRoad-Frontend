#!/bin/sh
set -eu

: "${API_BASE_URL:=http://localhost:8080/api/v1}"
: "${AI_BASE_URL:=$API_BASE_URL}"
: "${ONLYOFFICE_URL:=http://localhost:8082}"

envsubst '${API_BASE_URL} ${AI_BASE_URL} ${ONLYOFFICE_URL}' \
  < /usr/share/nginx/html/assets/config.template.js \
  > /usr/share/nginx/html/assets/config.js
