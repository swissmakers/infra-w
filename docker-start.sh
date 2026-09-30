#!/bin/sh
set -e

DATA_DIR=/app/data

# Drop root: run as the owner of the data directory, or as infra-w on a fresh root-owned volume
if [ "$(id -u)" = "0" ]; then
    mkdir -p "$DATA_DIR"
    owner="$(stat -c %u:%g "$DATA_DIR")"
    if [ "$owner" = "0:0" ]; then owner="$(id -u infra-w):$(id -g infra-w)"; fi
    find "$DATA_DIR" \( ! -user "${owner%:*}" -o ! -group "${owner#*:}" \) -exec chown -h "$owner" {} +
    export HOME=/tmp
    exec su-exec "$owner" /bin/sh "$0" "$@"
fi

case "${LOG_LEVEL:-system}" in
    error) GUACD_ARGS="-L error" ;;
    warn) GUACD_ARGS="-L warning" ;;
    verbose) GUACD_ARGS="-L debug" ;;
    debug) GUACD_ARGS="-L trace" ;;
    *) GUACD_ARGS="-L info" ;;
esac

# guacd is only reached by the server in this container.
guacd -b 127.0.0.1 -l 4822 $GUACD_ARGS -f &
exec node server/index.js
