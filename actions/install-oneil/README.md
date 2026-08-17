# `oneil/install-oneil`

Install the Oneil CLI from a [GitHub Release](https://github.com/careweather/oneil/releases) onto `PATH` for the rest of the job.

Prefer this Action when your workflow needs `oneil` directly (custom scripts, ad-hoc `oneil test`, etc.). For model-repo CI that should discover models and produce a Markdown report, use [`model-test-report`](../model-test-report/README.md) instead.

## Usage

```yaml
- uses: actions/checkout@v4

# The release CLI links against an installed Python 3.12. Install that
# layout before this Action so it can pick the matching archive flavor.
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"

- uses: careweather/oneil/actions/install-oneil@v1.0.0
  with:
    version: v1.0.0

- run: oneil test --recursive model/radar.on
```

Pin the Action ref and `version` to the **same** release tag.

The same script is attached to each GitHub Release as `install-oneil.sh` (stamped with that tag). Locally:

```sh
curl -fsSL https://github.com/careweather/oneil/releases/download/v1.0.0/install-oneil.sh | bash
```

That installs into `~/.local/bin` (override with `ONEIL_INSTALL_DIR`). In Actions, prefer the composite Action above so `GITHUB_PATH` / outputs are set.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `version` | yes | | Release tag to install (e.g. `v1.0.0`) |
| `github-token` | no | `${{ github.token }}` | Token used by `gh release download` (rate limits) |

## Outputs

| Output | Description |
|--------|-------------|
| `version` | Text from `oneil --version` |
| `oneil-path` | Absolute path to the installed binary |

## Platforms

The Action detects Homebrew `python@3.12`, then `uv python find 3.12`, then a system 3.12, and downloads that flavor (`…-homebrew`, `…-uv`, or `…-system`). Older unflavored 1.x archives are a fallback. On macOS, `actions/setup-python` is not the `system` layout (that flavor is the python.org framework); use Homebrew or uv there.

| Runner | Archives |
|--------|----------|
| `ubuntu-*` (x86_64) | `oneil-<tag>-x86_64-unknown-linux-gnu-{system,uv}.tar.gz` |
| `windows-*` (x86_64) | `oneil-<tag>-x86_64-pc-windows-msvc-{system,uv}.zip` |
| `macos-*` (Apple Silicon) | `oneil-<tag>-aarch64-apple-darwin-{homebrew,system,uv}.tar.gz` |

These archives are produced by the Oneil [Release](https://github.com/careweather/oneil/blob/main/.github/workflows/release.yml) workflow when a `v*` tag is pushed.
