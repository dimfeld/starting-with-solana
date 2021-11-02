#!/bin/bash
set -euo pipefail
anchor build
mkdir -p app/src/lib/idl

for file in todo; do
  METADATA=$(solana address -k target/deploy/${file}-keypair.json)
  jq --arg id ${METADATA} '. + {"metadata":{ "address": $id }}' target/idl/${file}.json   > app/src/lib/idl/${file}.json
done

