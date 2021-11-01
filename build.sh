#!/bin/bash
set -euo pipefail
anchor build
mkdir -p app/src/lib/idl
cp target/idl/* app/src/lib/idl/
