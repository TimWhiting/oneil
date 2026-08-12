#!/usr/bin/env bash
set -euo pipefail

# Repository root (directory containing this script).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

WITH_PYTHON_COMPILER=false
EDITABLE=false

usage() {
	cat <<'EOF'
Usage: install.sh [options]

  Builds and installs the Rust Oneil CLI with Cargo (default features:
  `rust-lib` + `python-lib`). That build links PyO3 so models can `import`
  ordinary `.py` files and so helper modules can `import oneil`.

Options:
  --with-python-package   Also install the Python library via pip (`import oneil`
                          from a standalone interpreter; not required for model
                          `.py` imports when using the CLI).
  -e, --editable          With --with-python-package, install it editable.
  -h, --help              Show this help.

Prerequisites:
  - Cargo (Rust): https://rustup.rs/
  - gcc (or another C toolchain Cargo can use for linking on this platform)
  - Python 3.10+ development headers (the CLI links against libpython for
    model Python imports; e.g. python3-devel / python3-dev)
  - For --with-python-package: Python 3.10+ with pip
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--with-python-compiler | --with-python-package) WITH_PYTHON_COMPILER=true ;;
	--no-python)
		# Former default-off switch; kept so old invocations do not fail.
		echo "Note: --no-python skips the pip Python library; the CLI still includes python-lib." >&2
		;;
	-e | --editable) EDITABLE=true ;;
	-h | --help)
		usage
		exit 0
		;;
	*)
		echo "Unknown option: $1" >&2
		usage >&2
		exit 1
		;;
	esac
	shift
done

if [[ "$EDITABLE" == true && "$WITH_PYTHON_COMPILER" == false ]]; then
	echo "Note: --editable only applies with --with-python-package." >&2
fi

if ! command -v cargo >/dev/null 2>&1; then
	cat >&2 <<EOF
Error: Cargo was not found on your PATH.

Install the Rust toolchain with rustup:
  https://rustup.rs/

  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

Then restart your terminal, or run:
  source ${HOME}/.cargo/env
EOF
	exit 1
fi

if ! command -v gcc >/dev/null 2>&1; then
	cat >&2 <<'EOF'
Error: gcc was not found on your PATH.

A C compiler is required to build Oneil (Rust linking and native extensions).

Install one of:
  Fedora/RHEL: sudo dnf install gcc
  Debian/Ubuntu: sudo apt install build-essential
EOF
	exit 1
fi

ONEIL_PKG="$SCRIPT_DIR/src/oneil"
if [[ ! -f "$ONEIL_PKG/Cargo.toml" ]]; then
	echo "Error: expected Cargo.toml at $ONEIL_PKG" >&2
	exit 1
fi

# Resolve a Python interpreter for header checks (and optional pip install).
PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
	PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
	PYTHON_CMD="python"
else
	cat <<'EOF' >&2
Error: Python 3.10+ was not found (needed to link the Rust CLI's model Python support).

Install Python and development headers, then re-run this script.
EOF
	exit 1
fi

if ! "$PYTHON_CMD" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
	echo "Error: Python 3.10 or newer is required. Found: $($PYTHON_CMD --version 2>&1)" >&2
	exit 1
fi

if ! "$PYTHON_CMD" -c 'import os, sys, sysconfig; inc=sysconfig.get_path("include"); sys.exit(0 if os.path.isfile(os.path.join(inc, "Python.h")) else 1)' 2>/dev/null; then
	cat >&2 <<'EOF'
Error: Python development headers were not found (Python.h is missing).

The Rust CLI links against Python so models can import `.py` files.

Install the development package for your distribution, then re-run this script:
  Fedora/RHEL: sudo dnf install python3-devel
  Debian/Ubuntu: sudo apt install python3-dev
EOF
	exit 1
fi

if [[ "$WITH_PYTHON_COMPILER" == true && ! -f "$SCRIPT_DIR/pyproject.toml" ]]; then
	echo "Error: pyproject.toml not found at $SCRIPT_DIR" >&2
	exit 1
fi

echo "Installing Rust Oneil CLI (default features: rust-lib + python-lib)..."
cargo install --force --path "$ONEIL_PKG"

if [[ "$WITH_PYTHON_COMPILER" == true ]]; then
	echo "Installing Python library (\`import oneil\`)..."
	cd "$SCRIPT_DIR"
	if [[ "$EDITABLE" == true ]]; then
		"$PYTHON_CMD" -m pip install -e .
	else
		"$PYTHON_CMD" -m pip install .
	fi
fi

echo ""
echo "Done."
echo "Ensure ~/.cargo/bin is on your PATH to run: oneil --version"
