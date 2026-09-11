#!/usr/bin/env bash
# The LMS-content quality gate. CI (.github/workflows/ci.yml) and the local
# pre-PR check (hyperstack/bin/pre-pr) both run exactly this; see hyperstack
# AGREEMENT §4. The local pre-PR check also builds LMS against this checkout.
set -euo pipefail
cd "$(dirname "$0")/.."
step() { printf '\n▶ %s\n' "$1"; }

step "unit tests"
node --test schema/*.test.mjs pipeline/*.test.mjs scripts/schema-declarations.test.mjs simulations/tests/*.test.mjs

step "schema declarations are generated from the implementation"
node scripts/schema-declarations.mjs --check

step "validate published content"
node pipeline/validate.mjs

step "validate published and staged content"
node pipeline/validate.mjs --staging

step "dependency audit"
node --test scripts/audit-gate.test.mjs
node scripts/audit-gate.mjs

printf '\n✔ gate passed\n'
