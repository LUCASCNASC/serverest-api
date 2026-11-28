#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:=http://127.0.0.1:3000}"
: "${RUNNER_TEMP:=${TMPDIR:-/tmp}}"

log_file="$RUNNER_TEMP/serverest.log"

npm exec -- serverest --nodoc > "$log_file" 2>&1 &

for tentativa in $(seq 1 30); do
  status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
    --max-time 2 "$BASE_URL/usuarios" || true)
  if [ "$status" = "200" ]; then
    echo "ServeRest local disponível em $BASE_URL"
    exit 0
  fi
  sleep 2
done

cat "$log_file"
echo "::error title=ServeRest local indisponível::A instância local não ficou pronta em 60 segundos."
exit 1
