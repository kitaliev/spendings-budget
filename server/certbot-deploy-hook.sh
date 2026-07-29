#!/bin/bash
set -euo pipefail

CERTS_DIR="/opt/budget-app/repo/server/certs"
mkdir -p "$CERTS_DIR"
cp "$RENEWED_LINEAGE/fullchain.pem" "$CERTS_DIR/fullchain.pem"
cp "$RENEWED_LINEAGE/privkey.pem" "$CERTS_DIR/privkey.pem"
chown budget:budget "$CERTS_DIR/fullchain.pem" "$CERTS_DIR/privkey.pem"
chmod 644 "$CERTS_DIR/fullchain.pem"
chmod 600 "$CERTS_DIR/privkey.pem"
