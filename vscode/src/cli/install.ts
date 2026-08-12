/**
 * Download and install a single managed Oneil CLI binary under globalStorage.
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { execFile } from "child_process"
import { promisify } from "util"
import type * as vscode from "vscode"

import { fetchCliReleaseByTag, type GithubRelease } from "./github"
import { resolveCliPlatform, SUPPORTED_PLATFORMS_LABEL } from "./platforms"
import { toReleaseTag } from "./version"

const execFileAsync = promisify(execFile)

/**
 * Absolute path to the managed CLI binary for this host, or `undefined` if
 * the platform is unsupported.
 */
export function managedBinaryPath(context: vscode.ExtensionContext): string | undefined {
    const platform = resolveCliPlatform()
    if (!platform) {
        return undefined
    }
    return path.join(context.globalStorageUri.fsPath, "cli", platform.binaryName)
}

/**
 * True when a managed binary file exists on disk.
 */
export async function managedBinaryExists(context: vscode.ExtensionContext): Promise<boolean> {
    const binaryPath = managedBinaryPath(context)
    if (!binaryPath) {
        return false
    }
    try {
        await fs.access(binaryPath)
        return true
    } catch {
        return false
    }
}

/**
 * Downloads `release` into the fixed managed path (overwriting any previous binary).
 */
export async function installCliRelease(
    context: vscode.ExtensionContext,
    release: GithubRelease,
): Promise<string> {
    const platform = resolveCliPlatform()
    if (!platform) {
        throw new Error(
            `This platform is not supported for release binaries (${SUPPORTED_PLATFORMS_LABEL}).`,
        )
    }

    const storageRoot = path.join(context.globalStorageUri.fsPath, "cli")
    await fs.mkdir(storageRoot, { recursive: true })

    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "oneil-cli-"))
    const archivePath = path.join(tmpRoot, release.assetName)

    try {
        await downloadFile(release.assetUrl, archivePath)
        await extractArchive(archivePath, tmpRoot)

        const extracted = path.join(tmpRoot, platform.binaryName)
        try {
            await fs.access(extracted)
        } catch {
            throw new Error(`Archive ${release.assetName} did not contain ${platform.binaryName}`)
        }

        const dest = path.join(storageRoot, platform.binaryName)
        await fs.rm(dest, { force: true })
        await fs.copyFile(extracted, dest)
        await fs.chmod(dest, 0o755)

        if (process.platform === "darwin") {
            try {
                await execFileAsync("xattr", ["-d", "com.apple.quarantine", dest])
            } catch {
                // Quarantine attribute may be absent.
            }
        }

        return dest
    } finally {
        await fs.rm(tmpRoot, { recursive: true, force: true })
    }
}

/**
 * Installs the release identified by `tagOrVersion` (with or without `v`).
 */
export async function installCliTag(
    context: vscode.ExtensionContext,
    tagOrVersion: string,
): Promise<string> {
    const platform = resolveCliPlatform()
    if (!platform) {
        throw new Error(
            `This platform is not supported for release binaries (${SUPPORTED_PLATFORMS_LABEL}).`,
        )
    }
    const release = await fetchCliReleaseByTag(toReleaseTag(tagOrVersion), platform)
    return installCliRelease(context, release)
}

async function downloadFile(url: string, dest: string): Promise<void> {
    const response = await fetch(url, {
        headers: { "User-Agent": "careweather-oneil-vscode" },
        redirect: "follow",
    })
    if (!response.ok) {
        throw new Error(`Download failed: HTTP ${response.status} for ${url}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    await fs.writeFile(dest, buffer)
}

async function extractArchive(archivePath: string, destDir: string): Promise<void> {
    if (archivePath.endsWith(".zip")) {
        if (process.platform === "win32") {
            await execFileAsync("powershell.exe", [
                "-NoProfile",
                "-Command",
                `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
            ])
            return
        }
        await execFileAsync("unzip", ["-o", archivePath, "-d", destDir])
        return
    }

    await execFileAsync("tar", ["-xzf", archivePath, "-C", destDir])
}
