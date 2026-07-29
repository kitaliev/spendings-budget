#!/bin/bash
set -euo pipefail

# Only fires when certbot actually renews (unlike --pre-hook/--post-hook,
# which run on every daily check regardless of whether renewal happened) —
# so budget-server is only ever restarted when there's a genuinely new
# cert to pick up, not once a day for nothing.
CERTS_DIR="/opt/budget-app/repo/server/certs"
mkdir -p "$CERTS_DIR"
cp "$RENEWED_LINEAGE/fullchain.pem" "$CERTS_DIR/fullchain.pem"
cp "$RENEWED_LINEAGE/privkey.pem" "$CERTS_DIR/privkey.pem"
chown budget:budget "$CERTS_DIR/fullchain.pem" "$CERTS_DIR/privkey.pem"
chmod 644 "$CERTS_DIR/fullchain.pem"
chmod 600 "$CERTS_DIR/privkey.pem"
systemctl restart budget-server
