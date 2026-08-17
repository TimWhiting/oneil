/**
 * GitHub Releases helpers for careweather/oneil CLI archives.
 */

import {
    isManagedReleaseVersion,
    isPrereleaseVersion,
    MIN_MANAGED_CLI_VERSION,
    pickLatestManagedRelease,
    toReleaseTag,
} from "./version"
import { cliAssetCandidates, type CliPlatform } from "./platforms"
import type { PythonFlavor } from "./python"

const REPO = "careweather/oneil"
const API = `https://api.github.com/repos/${REPO}`

export type GithubRelease = {
    tag: string
    name: string
    prerelease: boolean
    /** Browser download URL for the CLI archive on this platform, if present. */
    assetUrl: string
    assetName: string
    /** Flavor used to select the asset (unflavored fallback still records the requested flavor). */
    flavor: PythonFlavor
}

type GithubApiRelease = {
    tag_name: string
    name: string | null
    prerelease: boolean
    assets: Array<{ name: string; browser_download_url: string }>
}

/**
 * Fetches the CLI release the installer should treat as latest for `platform`.
 *
 * Does not use GitHub’s `/releases/latest` — that endpoint follows
 * `make_latest` on the Release workflow, which historically marked 1.0.0
 * betas as latest. Instead we list releases and pick the newest stable 1.x,
 * or the newest 1.x prerelease if no stable exists yet.
 */
export async function fetchLatestCliRelease(
    platform: CliPlatform,
    flavor: PythonFlavor,
): Promise<GithubRelease> {
    const releases = await listCliReleases(platform, flavor, 100)
    const release = pickLatestManagedRelease(releases)
    if (!release) {
        throw new Error(
            `No ${MIN_MANAGED_CLI_VERSION}+ CLI archive was found for ${platform.triple} (${flavor})`,
        )
    }
    return release
}

/**
 * Lists recent 1.x releases (including prereleases) that include a CLI asset for `platform` (newest first).
 */
export async function listCliReleases(
    platform: CliPlatform,
    flavor: PythonFlavor,
    limit = 30,
): Promise<GithubRelease[]> {
    const body = await getJson<GithubApiRelease[]>(
        `${API}/releases?per_page=${Math.min(limit, 100)}`,
    )
    return body
        .map((item) => toCliRelease(item, platform, flavor))
        .filter((item): item is GithubRelease => item != null)
        .filter((item) => isManagedReleaseVersion(item.tag))
        .slice(0, limit)
}

/**
 * Resolves a specific tag’s CLI asset for `platform`.
 */
export async function fetchCliReleaseByTag(
    tag: string,
    platform: CliPlatform,
    flavor: PythonFlavor,
): Promise<GithubRelease> {
    const releaseTag = toReleaseTag(tag)
    if (!isManagedReleaseVersion(releaseTag)) {
        throw new Error(unsupportedReleaseMessage(releaseTag))
    }
    const body = await getJson<GithubApiRelease>(
        `${API}/releases/tags/${encodeURIComponent(releaseTag)}`,
    )
    const release = toCliRelease(body, platform, flavor)
    if (!release) {
        throw new Error(
            `Release ${body.tag_name} has no CLI archive for ${platform.triple} (${flavor})`,
        )
    }
    return release
}

/**
 * Direct download URL for a known tag/asset.
 */
export function releaseDownloadUrl(tag: string, archiveName: string): string {
    return `https://github.com/${REPO}/releases/download/${toReleaseTag(tag)}/${archiveName}`
}

function unsupportedReleaseMessage(tag: string): string {
    return `Release ${tag} is a 0.x build (before ${MIN_MANAGED_CLI_VERSION}) and is not supported by the extension-managed installer.`
}

function toCliRelease(
    body: GithubApiRelease,
    platform: CliPlatform,
    flavor: PythonFlavor,
): GithubRelease | undefined {
    const expected = cliAssetCandidates(platform, body.tag_name, flavor)
    const asset = body.assets.find((a) => expected.includes(a.name))
    if (!asset) {
        return undefined
    }
    return {
        tag: body.tag_name,
        name: body.name ?? body.tag_name,
        prerelease: body.prerelease || isPrereleaseVersion(body.tag_name),
        assetUrl: asset.browser_download_url,
        assetName: asset.name,
        flavor,
    }
}

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "careweather-oneil-vscode",
        },
    })
    if (!response.ok) {
        throw new Error(`GitHub request failed: HTTP ${response.status}`)
    }
    return (await response.json()) as T
}
