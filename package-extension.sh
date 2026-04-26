#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
STAGE_DIR="${DIST_DIR}/jira-snap-package"

cleanup() {
  rm -rf "${STAGE_DIR}"
}

trap cleanup EXIT

required_files=(
  "manifest.json"
  "background.js"
  "content-script.js"
  "popup.html"
  "popup.js"
)

required_dirs=(
  "images"
  "styles"
  "_locales"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "${ROOT_DIR}/${file}" ]]; then
    printf 'Missing required file: %s\n' "${file}" >&2
    exit 1
  fi
done

for dir in "${required_dirs[@]}"; do
  if [[ ! -d "${ROOT_DIR}/${dir}" ]]; then
    printf 'Missing required directory: %s\n' "${dir}" >&2
    exit 1
  fi
done

if ! command -v zip >/dev/null 2>&1; then
  printf 'zip command is required but not installed.\n' >&2
  exit 1
fi

VERSION="$(python3 - <<'PY'
import json
from pathlib import Path

manifest = json.loads(Path('manifest.json').read_text(encoding='utf-8'))
print(manifest['version'])
PY
)"

ZIP_NAME="jira-snap-v${VERSION}.zip"
ZIP_PATH="${DIST_DIR}/${ZIP_NAME}"

rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}" "${DIST_DIR}"

for file in "${required_files[@]}"; do
  cp "${ROOT_DIR}/${file}" "${STAGE_DIR}/${file}"
done

for dir in "${required_dirs[@]}"; do
  cp -R "${ROOT_DIR}/${dir}" "${STAGE_DIR}/${dir}"
done

if [[ -f "${ROOT_DIR}/LICENSE" ]]; then
  cp "${ROOT_DIR}/LICENSE" "${STAGE_DIR}/LICENSE"
fi

rm -f "${ZIP_PATH}"
(
  cd "${STAGE_DIR}"
  zip -r "${ZIP_PATH}" . >/dev/null
)

printf 'Extension package created: %s\n' "${ZIP_PATH}"
