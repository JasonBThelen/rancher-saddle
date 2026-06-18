#!/usr/bin/env bash
set -e

CHART="helm/rancher-saddle"
PASS=0
FAIL=0

assert_contains() {
  local description="$1" output="$2" expected="$3"
  if echo "$output" | grep -qF "$expected"; then
    echo "  PASS: $description"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $description"
    echo "        expected to find: $expected"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local description="$1" output="$2" unexpected="$3"
  if ! echo "$output" | grep -qF "$unexpected"; then
    echo "  PASS: $description"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $description"
    echo "        should not contain: $unexpected"
    FAIL=$((FAIL + 1))
  fi
}

echo "Helm template tests"
echo "-------------------"

# Test 1: trailing slash on upstream.url is stripped
out=$(helm template test "$CHART" --set upstream.url=https://rancher.example.com/)
assert_contains     "trailing slash stripped from proxy_pass"     "$out" "proxy_pass https://rancher.example.com;"
assert_not_contains "trailing slash absent from proxy_pass"       "$out" "proxy_pass https://rancher.example.com/;"

# Test 2: tlsVerify defaults to off
out=$(helm template test "$CHART" --set upstream.url=https://rancher.example.com)
assert_contains "tlsVerify defaults to proxy_ssl_verify off" "$out" "proxy_ssl_verify off;"

# Test 3: tlsVerify=true renders on
out=$(helm template test "$CHART" --set upstream.url=https://rancher.example.com --set upstream.tlsVerify=true)
assert_contains "tlsVerify=true renders proxy_ssl_verify on" "$out" "proxy_ssl_verify on;"

# Test 4: PWA wiring
out=$(helm template test "$CHART" --set upstream.url=https://rancher.example.com)
assert_contains "manifest link injected"            "$out" 'rel="manifest" href="/_saddle/manifest.json"'
assert_contains "apple-touch-icon injected"         "$out" 'href="/_saddle/icons/apple-touch-icon.png"'
assert_contains "service worker scope header set"   "$out" 'add_header Service-Worker-Allowed "/";'
assert_contains "overlay carries sw.js"             "$out" "sw.js: |"
assert_contains "overlay carries manifest.json"     "$out" "manifest.json: |"
assert_contains "png icons land in binaryData"      "$out" "icon-512.png:"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
