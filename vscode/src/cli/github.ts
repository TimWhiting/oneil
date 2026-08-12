/**
 * GitHub Releases helpers for careweather/oneil CLI archives.
 */

import { toReleaseTag } from "./version"
import type { CliPlatform } from "./platforms"

const REPO = "careweather/oneil"
const API = `https://api.github.com/repos/${REPO}`

export type GithubRelease = {
    tag: string
    name: string
    prerelease: boolean
    /** Browser download URL for the CLI archive on this platform, if present. */
    assetUrl: string
    assetName: string
}

type GithubApiRelease = {
    tag_name: string
    name: string | null
    prerelease: boolean
    assets: Array<{ name: string; browser_download_url: string }>
}

/**
 * Fetches the latest non-prerelease release that includes a CLI asset for `platform`.
 */
export async function fetchLatestCliRelease(platform: CliPlatform): Promise<GithubRelease> {
    const body = await getJson<GithubApiRelease>(`${API}/releases/latest`)
    const release = toCliRelease(body, platform)
    if (!release) {
        throw new Error(
            `Latest release ${body.tag_name} has no CLI archive for ${platform.triple}`,
        )
    }
    return release
}

/**
 * Lists recent releases that include a CLI asset for `platform` (newest first).
 */
export async function listCliReleases(
    platform: CliPlatform,
    limit = 30,
): Promise<GithubRelease[]> {
    const body = await getJson<GithubApiRelease[]>(
        `${API}/releases?per_page=${Math.min(limit, 100)}`,
    )
    return body
        .map((item) => toCliRelease(item, platform))
        .filter((item): item is GithubRelease => item != null)
        .slice(0, limit)
}

/**
 * Resolves a specific tag’s CLI asset for `platform`.
 */
export async function fetchCliReleaseByTag(
    tag: string,
    platform: CliPlatform,
): Promise<GithubRelease> {
    const releaseTag = toReleaseTag(tag)
    const body = await getJson<GithubApiRelease>(
        `${API}/releases/tags/${encodeURIComponent(releaseTag)}`,
    )
    const release = toCliRelease(body, platform)
    if (!release) {
        throw new Error(
            `Release ${body.tag_name} has no CLI archive for ${platform.triple}`,
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

function toCliRelease(body: GithubApiRelease, platform: CliPlatform): GithubRelease | undefined {
    const expected = platform.archiveName(body.tag_name)
    const asset = body.assets.find((a) => a.name === expected)
    if (!asset) {
        return undefined
    }
    return {
        tag: body.tag_name,
        name: body.name ?? body.tag_name,
        prerelease: body.prerelease,
        assetUrl: asset.browser_download_url,
        assetName: asset.name,
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
