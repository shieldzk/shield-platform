#!/bin/sh
set -e

# Compose passes unset variables as empty strings, which the API rejects as invalid.
# Drop the empty optional ones so the API treats them as unset.
for var in CLAIM_DATA_KEY CONSERVATION_CIRCUITS_DIR STELLAR_RPC_URL \
  STELLAR_NETWORK_PASSPHRASE VAULT_CONTRACT_ID INDEXER_START_LEDGER INDEXER_POLL_MS; do
  eval "value=\${$var:-}"
  if [ -z "$value" ]; then
    unset "$var"
  fi
done

# Turn proving on only when shield-contracts' circuits are mounted at /circuits
# (lib/, node_modules/ and the conservation_main keys in build/). Without them the
# API runs with proving off instead of refusing to start.
if [ -z "${CONSERVATION_CIRCUITS_DIR:-}" ] \
  && [ -f /circuits/lib/conservation.js ] \
  && [ -f /circuits/build/conservation_main_final.zkey ]; then
  export CONSERVATION_CIRCUITS_DIR=/circuits
fi

exec bun src/index.ts
