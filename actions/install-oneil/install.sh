#!/usr/bin/env bash
# Download a Oneil CLI release archive and put it on PATH.
# Expected env: ONEIL_VERSION, and optionally GH_TOKEN / GITHUB_TOKEN for gh.
set -euo pipefail

case "${RUNNER_OS}/${RUNNER_ARCH}" in
  Linux/X64)
    triple="x86_64-unknown-linux-gnu"
    ext="tar.gz"
    binary_name="oneil"
    ;;
  Windows/X64)
    triple="x86_64-pc-windows-msvc"
    ext="zip"
    binary_name="oneil.exe"
    ;;
  macOS/ARM64)
    triple="aarch64-apple-darwin"
    ext="tar.gz"
    binary_name="oneil"
    ;;
  *)
    echo "::error::Unsupported runner: ${RUNNER_OS}/${RUNNER_ARCH} (release binaries cover Linux x86_64, Windows x86_64, and Apple Silicon macOS)"
    exit 1
    ;;
esac

detect_flavor() {
  if [[ "${RUNNER_OS}" == "macOS" ]] \
    && [[ -e /opt/homebrew/opt/python@3.12/Frameworks/Python.framework/Versions/3.12/Python ]]; then
    echo homebrew
    return
  fi

  if command -v uv >/dev/null 2>&1 && uv python find 3.12 >/dev/null 2>&1; then
    echo uv
    return
  fi

  if [[ "${RUNNER_OS}" == "macOS" ]] \
    && [[ -e /Library/Frameworks/Python.framework/Versions/3.12/Python ]]; then
    echo system
    return
  fi

  if [[ "${RUNNER_OS}" == "Linux" ]] \
    && { [[ -e /usr/lib/x86_64-linux-gnu/libpython3.12.so.1.0 ]] \
      || [[ -e /usr/lib64/libpython3.12.so.1.0 ]] \
      || command -v python3.12 >/dev/null 2>&1; }; then
    echo system
    return
  fi

  if [[ "${RUNNER_OS}" == "Windows" ]]; then
    if py -3.12 -c "import sys" >/dev/null 2>&1 || python3.12 -c "import sys" >/dev/null 2>&1; then
      echo system
      return
    fi
  fi
}

python_libdir() {
  local py="$1"
  "${py}" -c 'import os, sys, sysconfig
if sys.platform == "win32":
    print(os.path.dirname(sys.executable))
else:
    print(sysconfig.get_config_var("LIBDIR") or "")
'
}

export_lib_path() {
  local py libdir
  py="$1"
  libdir="$(python_libdir "${py}")"
  if [[ -z "${libdir}" ]]; then
    return
  fi
  if [[ "${RUNNER_OS}" == "macOS" ]]; then
    export DYLD_LIBRARY_PATH="${libdir}${DYLD_LIBRARY_PATH:+:${DYLD_LIBRARY_PATH}}"
    echo "DYLD_LIBRARY_PATH=${DYLD_LIBRARY_PATH}" >> "${GITHUB_ENV}"
  elif [[ "${RUNNER_OS}" == "Linux" ]]; then
    export LD_LIBRARY_PATH="${libdir}${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
    echo "LD_LIBRARY_PATH=${LD_LIBRARY_PATH}" >> "${GITHUB_ENV}"
  else
    export PATH="${libdir}:${PATH}"
    echo "${libdir}" >> "${GITHUB_PATH}"
  fi
}

try_download() {
  local archive="$1"
  local download_url="https://github.com/careweather/oneil/releases/download/${ONEIL_VERSION}/${archive}"
  echo "Downloading ${download_url}"
  if command -v gh >/dev/null 2>&1; then
    gh release download "${ONEIL_VERSION}" \
      --repo careweather/oneil \
      --pattern "${archive}" \
      --dir .
  else
    curl -fsSL "${download_url}" -o "${archive}"
  fi
}

flavor="$(detect_flavor || true)"
if [[ -z "${flavor}" ]]; then
  echo "::error::Need Python 3.12 to run the release CLI (system, uv, or Homebrew python@3.12 on macOS)."
  exit 1
fi

if [[ "${flavor}" == "uv" ]]; then
  export_lib_path "$(uv python find 3.12)"
elif [[ "${flavor}" == "system" && "${RUNNER_OS}" == "Linux" ]] && command -v python3.12 >/dev/null 2>&1; then
  export_lib_path "$(command -v python3.12)"
elif [[ "${flavor}" == "system" && "${RUNNER_OS}" == "Windows" ]]; then
  if py -3.12 -c "import sys" >/dev/null 2>&1; then
    export_lib_path "$(py -3.12 -c "import sys; print(sys.executable)")"
  elif command -v python3.12 >/dev/null 2>&1; then
    export_lib_path "$(command -v python3.12)"
  fi
fi

install_dir="${RUNNER_TEMP}/oneil-${ONEIL_VERSION}"
mkdir -p "${install_dir}"
cd "${install_dir}"

flavored="oneil-${ONEIL_VERSION}-${triple}-${flavor}.${ext}"
unflavored="oneil-${ONEIL_VERSION}-${triple}.${ext}"
archive=""

if try_download "${flavored}"; then
  archive="${flavored}"
elif try_download "${unflavored}"; then
  echo "No ${flavored}; using unflavored archive from an older release"
  archive="${unflavored}"
else
  echo "::error::Could not download ${flavored} or ${unflavored}"
  exit 1
fi

if [[ "${archive}" == *.zip ]]; then
  if command -v unzip >/dev/null 2>&1; then
    unzip -o "${archive}"
  else
    python3 - "${archive}" <<'PY'
import sys, zipfile
zipfile.ZipFile(sys.argv[1]).extractall(".")
PY
  fi
else
  tar -xzf "${archive}"
fi

if [[ ! -f "${binary_name}" ]]; then
  echo "::error::Expected ${binary_name} in ${archive}"
  ls -la
  exit 1
fi

chmod +x "${binary_name}"
oneil_path="$(pwd)/${binary_name}"

# Soften macOS Gatekeeper when running unsigned release binaries in CI.
if [[ "${RUNNER_OS}" == "macOS" ]] && command -v xattr >/dev/null 2>&1; then
  xattr -d com.apple.quarantine "${oneil_path}" 2>/dev/null || true
fi

echo "${install_dir}" >> "${GITHUB_PATH}"
export PATH="${install_dir}:${PATH}"

if ! version_line="$("${oneil_path}" --version 2>"${RUNNER_TEMP}/oneil-version.err")"; then
  echo "::error::Installed oneil failed \`--version\` (flavor=${flavor}). Install matching Python 3.12."
  cat "${RUNNER_TEMP}/oneil-version.err" >&2 || true
  exit 1
fi
echo "Installed ${version_line} (${flavor})"
echo "version=${version_line}" >> "${GITHUB_OUTPUT}"
echo "oneil-path=${oneil_path}" >> "${GITHUB_OUTPUT}"
