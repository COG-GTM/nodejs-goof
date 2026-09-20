#!/usr/bin/env bash
#
# Container vulnerability-management example:
#   build image(s) -> SBOM (syft) -> scan SBOM (grype [+ trivy]) -> report
#
# Usage:
#   scripts/container-scan.sh                 # build + scan goof:baseline and goof:hardened
#   scripts/container-scan.sh --no-build      # scan already-built images
#   scripts/container-scan.sh node:18.13.0    # scan arbitrary image(s) instead
#
# Env:
#   OUT_DIR   where artifacts go               (default: scan-results)
#   FAIL_ON   critical|high|medium|low|negligible
#             exit 1 if any scanned image has a vuln at/above this severity
#             (default: unset -> report only)
#   NO_TRIVY  set to skip trivy even if installed
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_DIR="${OUT_DIR:-scan-results}"
FAIL_ON="${FAIL_ON:-}"
BUILD=1
IMAGES=()

for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=0 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) IMAGES+=("$arg") ;;
  esac
done

for tool in docker syft grype jq; do
  command -v "$tool" >/dev/null || { echo "missing required tool: $tool" >&2; exit 2; }
done
HAVE_TRIVY=0
if [[ -z "${NO_TRIVY:-}" ]] && command -v trivy >/dev/null; then HAVE_TRIVY=1; fi

if [[ ${#IMAGES[@]} -eq 0 ]]; then
  IMAGES=(goof:baseline goof:hardened)
  if [[ $BUILD -eq 1 ]]; then
    echo "==> building goof:baseline (Dockerfile)"
    docker build -q -t goof:baseline -f Dockerfile .
    echo "==> building goof:hardened (Dockerfile.hardened)"
    docker build -q -t goof:hardened -f Dockerfile.hardened .
  fi
fi

mkdir -p "$OUT_DIR"
SUMMARY="$OUT_DIR/summary.json"
echo '[]' > "$SUMMARY"

slug() { echo "$1" | tr '/:@' '___'; }

for image in "${IMAGES[@]}"; do
  s=$(slug "$image")
  echo
  echo "==> $image"

  echo "    sbom  -> $OUT_DIR/$s.sbom.spdx.json, $OUT_DIR/$s.sbom.cdx.json"
  syft "docker:$image" -q -o "spdx-json=$OUT_DIR/$s.sbom.spdx.json" -o "cyclonedx-json=$OUT_DIR/$s.sbom.cdx.json" -o "syft-json=$OUT_DIR/$s.sbom.syft.json"

  echo "    grype -> $OUT_DIR/$s.grype.json, $OUT_DIR/$s.grype.sarif, $OUT_DIR/$s.grype.txt"
  grype "sbom:$OUT_DIR/$s.sbom.syft.json" -q -o "json=$OUT_DIR/$s.grype.json" -o "sarif=$OUT_DIR/$s.grype.sarif" -o "table=$OUT_DIR/$s.grype.txt"

  trivy_total=null
  if [[ $HAVE_TRIVY -eq 1 ]]; then
    echo "    trivy -> $OUT_DIR/$s.trivy.json"
    trivy image -q --scanners vuln -f json -o "$OUT_DIR/$s.trivy.json" "$image" || echo "    trivy failed (continuing)" >&2
    if [[ -s "$OUT_DIR/$s.trivy.json" ]]; then
      trivy_total=$(jq '[.Results[]?.Vulnerabilities[]?] | length' "$OUT_DIR/$s.trivy.json")
    fi
  fi

  size_bytes=$(docker image inspect "$image" --format '{{.Size}}')
  base_os=$(jq -r '.distro | if .name then ([.name, .version] | map(select(. != null and . != "")) | join(" ")) else "unknown" end' "$OUT_DIR/$s.sbom.syft.json")

  jq -n \
    --arg image "$image" \
    --arg base_os "$base_os" \
    --argjson size_bytes "$size_bytes" \
    --argjson trivy_total "$trivy_total" \
    --slurpfile sbom "$OUT_DIR/$s.sbom.syft.json" \
    --slurpfile grype "$OUT_DIR/$s.grype.json" '
    ($sbom[0].artifacts) as $pkgs |
    ($grype[0].matches) as $m |
    {
      image: $image,
      base_os: $base_os,
      size_mb: (($size_bytes / 1048576 * 10 | round) / 10),
      packages: {
        total: ($pkgs | length),
        os:    ([$pkgs[] | select(.type | IN("apk","deb","rpm"))] | length),
        npm:   ([$pkgs[] | select(.type == "npm")] | length),
        other: ([$pkgs[] | select(.type | IN("apk","deb","rpm","npm") | not)] | length)
      },
      vulns: {
        total:      ($m | length),
        critical:   ([$m[] | select(.vulnerability.severity == "Critical")]   | length),
        high:       ([$m[] | select(.vulnerability.severity == "High")]       | length),
        medium:     ([$m[] | select(.vulnerability.severity == "Medium")]     | length),
        low:        ([$m[] | select(.vulnerability.severity == "Low")]        | length),
        negligible: ([$m[] | select(.vulnerability.severity == "Negligible")] | length),
        unknown:    ([$m[] | select(.vulnerability.severity == "Unknown")]    | length),
        fixable:    ([$m[] | select(.vulnerability.fix.state == "fixed")]     | length),
        in_os_pkgs: ([$m[] | select(.artifact.type | IN("apk","deb","rpm"))]  | length),
        in_npm_pkgs:([$m[] | select(.artifact.type == "npm")]                 | length)
      },
      trivy_total: $trivy_total
    }' > "$OUT_DIR/$s.summary.json"

  jq -s '.[0] + [.[1]]' "$SUMMARY" "$OUT_DIR/$s.summary.json" > "$SUMMARY.tmp" && mv "$SUMMARY.tmp" "$SUMMARY"
  jq -r '"    \(.vulns.total) vulns (C:\(.vulns.critical) H:\(.vulns.high) M:\(.vulns.medium) L:\(.vulns.low)) in \(.packages.total) packages, \(.size_mb) MB"' "$OUT_DIR/$s.summary.json"
done

REPORT="$OUT_DIR/report.md"
{
  echo "# Container vulnerability scan"
  echo
  echo "Generated $(date -u +%Y-%m-%dT%H:%MZ) with syft $(syft version -o json | jq -r .version), grype $(grype version -o json | jq -r .version)$( [[ $HAVE_TRIVY -eq 1 ]] && echo ", trivy $(trivy --version | head -1 | awk '{print $2}')" )."
  echo
  echo "| Image | Base OS | Size | Packages (os / npm) | Total | Critical | High | Medium | Low | Fixable | In OS pkgs | In npm pkgs |$( [[ $HAVE_TRIVY -eq 1 ]] && echo " Trivy total |" )"
  echo "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|$( [[ $HAVE_TRIVY -eq 1 ]] && echo "---:|" )"
  jq -r --argjson trivy "$HAVE_TRIVY" '.[] |
    "| `\(.image)` | \(.base_os) | \(.size_mb) MB | \(.packages.total) (\(.packages.os) / \(.packages.npm)) | **\(.vulns.total)** | \(.vulns.critical) | \(.vulns.high) | \(.vulns.medium) | \(.vulns.low) | \(.vulns.fixable) | \(.vulns.in_os_pkgs) | \(.vulns.in_npm_pkgs) |"
    + (if $trivy == 1 then " \(.trivy_total // "n/a") |" else "" end)' "$SUMMARY"
  echo
  echo "Severity counts are from grype. \"In OS pkgs\" is what the base image contributes (apk/deb/rpm); \"In npm pkgs\" is what the application's own dependencies contribute."
  echo
  for image in "${IMAGES[@]}"; do
    s=$(slug "$image")
    echo "## $image"
    echo
    echo "Top fixable findings (grype):"
    echo
    echo '```'
    jq -r '[.matches[] | select(.vulnerability.fix.state == "fixed")]
      | unique_by([.vulnerability.id, .artifact.name])
      | sort_by(.vulnerability.severity | {"Critical":0,"High":1,"Medium":2,"Low":3}[.] // 9)
      | .[:15][]
      | "\(.vulnerability.severity | .[0:4] | ascii_upcase)  \(.vulnerability.id)  \(.artifact.name)@\(.artifact.version) -> \(.vulnerability.fix.versions | join(", "))"' "$OUT_DIR/$s.grype.json"
    echo '```'
    echo
    echo "Artifacts: \`$s.sbom.spdx.json\`, \`$s.sbom.cdx.json\`, \`$s.grype.json\`, \`$s.grype.sarif\`, \`$s.grype.txt\`$( [[ $HAVE_TRIVY -eq 1 ]] && echo ", \`$s.trivy.json\`" )"
    echo
  done
} > "$REPORT"

echo
echo "==> report: $REPORT"
echo
cat "$REPORT" | sed -n '1,12p'

if [[ -n "$FAIL_ON" ]]; then
  levels=(negligible low medium high critical)
  threshold=-1
  for i in "${!levels[@]}"; do [[ "${levels[$i]}" == "${FAIL_ON,,}" ]] && threshold=$i; done
  [[ $threshold -lt 0 ]] && { echo "bad FAIL_ON value: $FAIL_ON" >&2; exit 2; }
  failed=0
  for image in "${IMAGES[@]}"; do
    s=$(slug "$image")
    n=$(jq --argjson t "$threshold" '[.matches[] | ({"Negligible":0,"Low":1,"Medium":2,"High":3,"Critical":4}[.vulnerability.severity] // -1) | select(. >= $t)] | length' "$OUT_DIR/$s.grype.json")
    if [[ "$n" -gt 0 ]]; then
      echo "FAIL: $image has $n vulnerabilities at or above '$FAIL_ON'"
      failed=1
    fi
  done
  exit $failed
fi
