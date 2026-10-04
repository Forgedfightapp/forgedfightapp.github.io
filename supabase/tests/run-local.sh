#!/bin/sh
# Local SQL tests (plain Postgres, e.g. `apt install postgresql`). Not part of CI; Supabase itself is never touched.
set -e
cd "$(dirname "$0")"
PSQL=${PSQL:-"sudo -u postgres psql -q -v ON_ERROR_STOP=1"}
$PSQL -c "drop database if exists forged_test" -c "create database forged_test"
$PSQL -d forged_test -f supabase_stub.sql
$PSQL -d forged_test -f ../migrations/001_social.sql
$PSQL -d forged_test -f ../migrations/001_social.sql   # idempotent: second run must succeed
$PSQL -d forged_test -f test_social.sql
$PSQL -d forged_test -f ../verify.sql
