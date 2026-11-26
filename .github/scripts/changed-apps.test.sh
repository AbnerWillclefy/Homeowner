#!/usr/bin/env bash
# Tests changed-apps.sh against a throwaway git repository.
# Run: .github/scripts/changed-apps.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo=$(mktemp -d)
trap 'rm -rf "$repo"' EXIT
cd "$repo"
git init -q -b main
git config user.email t@t && git config user.name t
mkdir backend && echo x >backend/a.go
git add -A && git commit -qm base
base=$(git rev-parse HEAD)
failures=0
all='backend=true web=true admin=true infra=true bedrock=true revenue=true'

# commit <path>...: back to base, then one commit that adds each path
commit() {
  git checkout -q --detach "$base"
  for p in "$@"; do mkdir -p "$(dirname "$p")"; echo "$RANDOM" >"$p"; done
  git add -A && git commit -qm change
}

# expect <name> <base> <expected keys, space separated>
expect() {
  local got; got=$("$here/changed-apps.sh" $2 | tr '\n' ' ' | sed 's/ $//')
  if [[ "$got" == "$3" ]]; then echo "ok   $1"; else echo "FAIL $1: expected [$3], got [$got]"; failures=$((failures + 1)); fi
}

# keys <true areas...>: the full expected line, every other key false
keys() {
  local out='' a
  for a in backend web admin infra bedrock revenue; do
    case " $* " in *" $a "*) out+="$a=true " ;; *) out+="$a=false " ;; esac
  done
  echo "${out% }"
}

commit revenue/x;                  expect "revenue only" "$base" "$(keys revenue)"
commit backend/x;                  expect "backend only" "$base" "$(keys backend)"
commit bedrock/x;                  expect "bedrock runs bedrock, revenue and web" "$base" "$(keys bedrock revenue web)"
commit package-lock.json;          expect "root package-lock.json" "$base" "$(keys bedrock revenue web)"
commit package.json;               expect "root package.json" "$base" "$(keys bedrock revenue web)"
commit .github/workflows/x.yml;    expect "a workflow runs everything" "$base" "$all"
commit .github/scripts/x.sh;       expect "a script runs everything" "$base" "$all"
commit web/src/tokens.css;         expect "web tokens.css runs web only" "$base" "$(keys web)"
commit web/src/a.tsx;              expect "web source runs web only" "$base" "$(keys web)"
commit docs/design/homeowner/X.dc.html; expect "a Homeowner artboard runs web only" "$base" "$(keys web)"
commit docs/design/revenue/X.dc.html; expect "a Revenue artboard runs nothing" "$base" "$(keys)"
commit admin/x;                    expect "admin only" "$base" "$(keys admin)"
commit infra/x.tf;                 expect "infra only" "$base" "$(keys infra)"
commit docs/x.md;                  expect "docs run nothing" "$base" "$(keys)"
commit revenue/x web/src/a.tsx;    expect "two areas together" "$base" "$(keys web revenue)"

git checkout -q --detach "$base"; mkdir docs; git mv backend/a.go docs/a.go; git commit -qm move
expect "moving a file out of backend/ still runs backend" "$base" "$(keys backend)"

git checkout -q --detach "$base"; git commit -q --allow-empty -m empty
expect "an empty diff runs nothing" "$base" "$(keys)"

commit revenue/x;                  expect "no base runs everything" "" "$all"
expect "an unknown SHA runs everything" 0123456789abcdef0123456789abcdef01234567 "$all"
sibling=$(git rev-parse HEAD)
git checkout -q --detach "$base"; commit docs/y.md
expect "a base that is not an ancestor runs everything" "$sibling" "$all"

if (( failures )); then echo "$failures failed"; exit 1; fi
echo "all passed"
