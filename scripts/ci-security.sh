#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODE="${1:-all}"
FAIL_ON="${SECURITY_FAIL_ON:-high}"
NODE_IMAGE="${SECURITY_NODE_IMAGE:-docker.io/library/node:24-bookworm-slim}"
SYFT_IMAGE="${SECURITY_SYFT_IMAGE:-docker.io/anchore/syft:latest}"
ARTIFACT_DIR="${SECURITY_ARTIFACT_DIR:-${PROJECT_ROOT}/artifacts/security}"
GENERATE_SBOM="${SECURITY_GENERATE_SBOM:-0}"
DRY_RUN="${SECURITY_DRY_RUN:-0}"

RUNTIME=""
VOLUME_SUFFIX=""

log() {
  echo "[security] $*"
}

fail() {
  echo "[security] ERROR: $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: ./scripts/ci-security.sh [update|audit|all]

Environment variables:
  SECURITY_FAIL_ON        Severity threshold for failing audit (default: high)
                          Allowed: none|critical|high|moderate|low|info
  SECURITY_NODE_IMAGE     Node container image (default: node:24-bookworm-slim)
  SECURITY_SYFT_IMAGE     Syft container image (default: anchore/syft:latest)
  SECURITY_ARTIFACT_DIR   Output folder for reports (default: artifacts/security)
  SECURITY_GENERATE_SBOM  Set to 1 to generate SBOM files
  SECURITY_DRY_RUN        Set to 1 to print commands without executing
EOF
}

detect_runtime() {
  if command -v podman >/dev/null 2>&1; then
    RUNTIME="podman"
    VOLUME_SUFFIX=":Z"
    return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    RUNTIME="docker"
    VOLUME_SUFFIX=""
    return 0
  fi

  fail "Neither podman nor docker is available on PATH."
}

run_node_container() {
  local workdir="$1"
  local cmd="$2"

  local runtime_args=(run --rm -v "${PROJECT_ROOT}:/workspace${VOLUME_SUFFIX}" -w "${workdir}")
  if [[ "${RUNTIME}" == "podman" ]]; then
    runtime_args+=(--userns=keep-id)
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY RUN: ${RUNTIME} ${runtime_args[*]} ${NODE_IMAGE} sh -lc \"${cmd}\""
    return 0
  fi

  "${RUNTIME}" "${runtime_args[@]}" "${NODE_IMAGE}" sh -lc "${cmd}"
}

run_syft_container() {
  local output_path="$1"
  local target_path="$2"

  local runtime_args=(run --rm -v "${PROJECT_ROOT}:/workspace${VOLUME_SUFFIX}" -w /workspace)
  if [[ "${RUNTIME}" == "podman" ]]; then
    runtime_args+=(--userns=keep-id)
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    log "DRY RUN: ${RUNTIME} ${runtime_args[*]} ${SYFT_IMAGE} ${target_path} -o spdx-json=${output_path}"
    return 0
  fi

  "${RUNTIME}" "${runtime_args[@]}" "${SYFT_IMAGE}" "${target_path}" -o "spdx-json=${output_path}"
}

prepare_artifacts() {
  mkdir -p "${ARTIFACT_DIR}"
}

to_container_path() {
  local host_path="$1"
  if [[ "${host_path}" == "${PROJECT_ROOT}"* ]]; then
    printf "/workspace%s" "${host_path#${PROJECT_ROOT}}"
    return 0
  fi

  fail "SECURITY_ARTIFACT_DIR must be inside ${PROJECT_ROOT} when using containerized commands."
}

extract_yarn_counts() {
  local jsonl_file="$1"
  python3 -c '
import json
import sys

file = sys.argv[1]
summary = None
with open(file, "r", encoding="utf-8") as handle:
    for line in handle:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        if obj.get("type") == "auditSummary":
            summary = (obj.get("data") or {}).get("vulnerabilities")

if not summary:
    print(f"Missing yarn audit summary in {file}", file=sys.stderr)
    sys.exit(2)

values = [
    int(summary.get("info", 0)),
    int(summary.get("low", 0)),
    int(summary.get("moderate", 0)),
    int(summary.get("high", 0)),
    int(summary.get("critical", 0)),
]
print(" ".join(str(v) for v in values), end="")
  ' "${jsonl_file}"
}

extract_pnpm_counts() {
  local json_file="$1"
  python3 -c '
import json
import sys

file = sys.argv[1]
with open(file, "r", encoding="utf-8") as handle:
    obj = json.load(handle)

vulns = ((obj.get("metadata") or {}).get("vulnerabilities"))
if not vulns:
    print(f"Missing pnpm audit summary in {file}", file=sys.stderr)
    sys.exit(2)

values = [
    int(vulns.get("info", 0)),
    int(vulns.get("low", 0)),
    int(vulns.get("moderate", 0)),
    int(vulns.get("high", 0)),
    int(vulns.get("critical", 0)),
]
print(" ".join(str(v) for v in values), end="")
  ' "${json_file}"
}

should_fail_by_threshold() {
  local info="$1"
  local low="$2"
  local moderate="$3"
  local high="$4"
  local critical="$5"

  case "${FAIL_ON}" in
    none) return 1 ;;
    critical) (( critical > 0 )) ;;
    high) (( high > 0 || critical > 0 )) ;;
    moderate) (( moderate > 0 || high > 0 || critical > 0 )) ;;
    low) (( low > 0 || moderate > 0 || high > 0 || critical > 0 )) ;;
    info) (( info > 0 || low > 0 || moderate > 0 || high > 0 || critical > 0 )) ;;
    *) fail "Invalid SECURITY_FAIL_ON='${FAIL_ON}'. Use none|critical|high|moderate|low|info." ;;
  esac
}

run_update() {
  log "Running dependency update pipeline in containers..."

  run_node_container "/workspace" \
    "corepack enable && corepack prepare yarn@1.22.22 --activate && yarn upgrade --latest && yarn install"

  run_node_container "/workspace/client" \
    "corepack enable && corepack prepare yarn@1.22.22 --activate && yarn upgrade --latest && yarn install"

  run_node_container "/workspace/landing" \
    "corepack enable && COREPACK_ENABLE_PROJECT_SPEC=0 corepack pnpm up --latest --store-dir /workspace/.pnpm-store"

}

run_audit() {
  log "Running vulnerability audits (threshold: ${FAIL_ON})..."
  prepare_artifacts

  local root_jsonl="${ARTIFACT_DIR}/root-yarn-audit.jsonl"
  local client_jsonl="${ARTIFACT_DIR}/client-yarn-audit.jsonl"
  local landing_json="${ARTIFACT_DIR}/landing-pnpm-audit.json"
  local container_artifact_dir
  container_artifact_dir="$(to_container_path "${ARTIFACT_DIR}")"

  run_node_container "/workspace" \
    "corepack enable && corepack prepare yarn@1.22.22 --activate && yarn install --frozen-lockfile && (yarn audit --level low --json || true) > '${container_artifact_dir}/root-yarn-audit.jsonl'"
  run_node_container "/workspace/client" \
    "corepack enable && corepack prepare yarn@1.22.22 --activate && yarn install --frozen-lockfile && (yarn audit --level low --json || true) > '${container_artifact_dir}/client-yarn-audit.jsonl'"
  run_node_container "/workspace/landing" \
    "corepack enable && COREPACK_ENABLE_PROJECT_SPEC=0 corepack pnpm install --frozen-lockfile --store-dir /workspace/.pnpm-store && (COREPACK_ENABLE_PROJECT_SPEC=0 corepack pnpm audit --json || true) > '${container_artifact_dir}/landing-pnpm-audit.json'"

  if [[ "${DRY_RUN}" == "1" ]]; then
    log "Dry-run enabled: skipping audit report parsing and threshold enforcement."
    return 0
  fi

  local root_counts client_counts landing_counts
  root_counts="$(extract_yarn_counts "${root_jsonl}")"
  client_counts="$(extract_yarn_counts "${client_jsonl}")"
  landing_counts="$(extract_pnpm_counts "${landing_json}")"

  local info low moderate high critical
  read -r info low moderate high critical <<<"${root_counts}"
  log "root: info=${info} low=${low} moderate=${moderate} high=${high} critical=${critical}"
  if should_fail_by_threshold "${info}" "${low}" "${moderate}" "${high}" "${critical}"; then
    fail "root audit exceeded threshold '${FAIL_ON}'"
  fi

  read -r info low moderate high critical <<<"${client_counts}"
  log "client: info=${info} low=${low} moderate=${moderate} high=${high} critical=${critical}"
  if should_fail_by_threshold "${info}" "${low}" "${moderate}" "${high}" "${critical}"; then
    fail "client audit exceeded threshold '${FAIL_ON}'"
  fi

  read -r info low moderate high critical <<<"${landing_counts}"
  log "landing: info=${info} low=${low} moderate=${moderate} high=${high} critical=${critical}"
  if should_fail_by_threshold "${info}" "${low}" "${moderate}" "${high}" "${critical}"; then
    fail "landing audit exceeded threshold '${FAIL_ON}'"
  fi
}

generate_sbom() {
  if [[ "${GENERATE_SBOM}" != "1" ]]; then
    return 0
  fi

  log "Generating SBOM artifacts..."
  prepare_artifacts
  local container_artifact_dir
  container_artifact_dir="$(to_container_path "${ARTIFACT_DIR}")"
  run_syft_container "${container_artifact_dir}/sbom-root.spdx.json" "dir:/workspace"
  run_syft_container "${container_artifact_dir}/sbom-client.spdx.json" "dir:/workspace/client"
  run_syft_container "${container_artifact_dir}/sbom-landing.spdx.json" "dir:/workspace/landing"
}

main() {
  detect_runtime
  log "Using runtime: ${RUNTIME}"

  case "${MODE}" in
    update)
      run_update
      generate_sbom
      ;;
    audit)
      run_audit
      generate_sbom
      ;;
    all)
      run_update
      run_audit
      generate_sbom
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      usage
      fail "Unknown mode '${MODE}'."
      ;;
  esac

  log "Completed successfully."
}

main "$@"
