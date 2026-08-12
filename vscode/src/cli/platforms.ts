/**
 * Platform → GitHub release archive mapping for the Oneil CLI.
 * Mirrors `actions/install-oneil/install.sh`.
 */

export type CliPlatform = {
    /** Rust target triple used in release asset names. */
    triple: string
    /** Archive filename for a given release tag (including `v` prefix). */
    archiveName: (tag: string) => string
    /** Binary name inside the archive. */
    binaryName: string
}

/**
 * Returns the release platform for this host, or `undefined` if unsupported.
 */
export function resolveCliPlatform(
    platform: NodeJS.Platform = process.platform,
    arch: string = process.arch,
): CliPlatform | undefined {
    if (platform === "linux" && arch === "x64") {
        return {
            triple: "x86_64-unknown-linux-gnu",
            archiveName: (tag) => `oneil-${tag}-x86_64-unknown-linux-gnu.tar.gz`,
            binaryName: "oneil",
        }
    }
    if (platform === "win32" && arch === "x64") {
        return {
            triple: "x86_64-pc-windows-msvc",
            archiveName: (tag) => `oneil-${tag}-x86_64-pc-windows-msvc.zip`,
            binaryName: "oneil.exe",
        }
    }
    if (platform === "darwin" && arch === "arm64") {
        return {
            triple: "aarch64-apple-darwin",
            archiveName: (tag) => `oneil-${tag}-aarch64-apple-darwin.tar.gz`,
            binaryName: "oneil",
        }
    }
    return undefined
}

/** Human-readable list of platforms that publish CLI archives. */
export const SUPPORTED_PLATFORMS_LABEL =
    "Linux x86_64, Windows x86_64, and Apple Silicon macOS"
