/**
 * Parse and compare Oneil CLI version ids from `oneil --version` and GitHub tags.
 * Uses the `semver` package for canonical version identity.
 */

import semver from "semver"

/** Oldest CLI release the extension-managed installer will download. */
export const MIN_MANAGED_CLI_VERSION = "1.0.0"

/**
 * Returns true when `tagOrVersion` is on the 1.x line or newer.
 *
 * Includes 1.0.0 prereleases (`1.0.0-beta.1`, `1.0.0-rc.1`) so those can be
 * installed from **Select CLI Version**. Rejects 0.x tags — those used
 * different archive layouts / install scripts.
 */
export function isManagedReleaseVersion(tagOrVersion: string): boolean {
    const id = normalizeVersionId(tagOrVersion)
    if (id == null) {
        return false
    }
    return semver.major(id) >= 1
}

/**
 * True when the tag is a semver prerelease (`1.0.0-beta.4`), even if GitHub
 * marked the release as latest / not a prerelease.
 */
export function isPrereleaseVersion(tagOrVersion: string): boolean {
    const id = normalizeVersionId(tagOrVersion)
    if (id == null) {
        return false
    }
    return semver.prerelease(id) != null
}

/**
 * Picks the release the installer should treat as “latest”.
 *
 * Prefers the newest stable 1.x. If none exists yet (only 1.0.0 betas),
 * falls back to the newest 1.x prerelease. Ignores 0.x.
 */
export function pickLatestManagedRelease<T extends { tag: string }>(releases: T[]): T | undefined {
    const ranked = releases
        .map((release) => {
            const id = normalizeVersionId(release.tag)
            if (id == null || !isManagedReleaseVersion(release.tag)) {
                return undefined
            }
            return { release, id }
        })
        .filter((row): row is { release: T; id: string } => row != null)
        .sort((a, b) => semver.rcompare(a.id, b.id))

    const stable = ranked.find((row) => semver.prerelease(row.id) == null)
    return (stable ?? ranked[0])?.release
}

/**
 * Extracts a comparable semver version from `oneil --version` stdout
 * (e.g. `oneil 1.0.0` → `1.0.0`) or returns `undefined` if unparsable.
 */
export function parseVersionOutput(stdout: string): string | undefined {
    const line = stdout.trim().split(/\r?\n/, 1)[0] ?? ""
    const match = /^oneil\s+(\S+)/i.exec(line)
    if (match?.[1]) {
        return normalizeVersionId(match[1])
    }
    const fallback = /\b(\d+\.\d+\.\d+\S*)\b/.exec(line)
    return fallback?.[1] ? normalizeVersionId(fallback[1]) : undefined
}

/**
 * Normalizes a GitHub tag or version string to a canonical semver id
 * (`v1.0.0` / `1.0.0` → `1.0.0`). Returns `undefined` if not a valid semver.
 */
export function normalizeVersionId(tagOrVersion: string): string | undefined {
    const cleaned = semver.clean(tagOrVersion.trim(), { loose: true })
    if (cleaned) {
        return cleaned
    }
    const coerced = semver.coerce(tagOrVersion.trim())
    return coerced?.version
}

/**
 * Returns true when `a` and `b` refer to the same semver identity.
 */
export function versionsEqual(a: string, b: string): boolean {
    const left = normalizeVersionId(a)
    const right = normalizeVersionId(b)
    if (left == null || right == null) {
        return false
    }
    return semver.eq(left, right)
}

/**
 * Returns true when `candidate` is a newer semver than `current`.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
    const next = normalizeVersionId(candidate)
    const prev = normalizeVersionId(current)
    if (next == null || prev == null) {
        return false
    }
    return semver.gt(next, prev)
}

/**
 * Ensures a GitHub tag form (`1.0.0` → `v1.0.0`; leaves `v…` alone).
 */
export function toReleaseTag(versionOrTag: string): string {
    const trimmed = versionOrTag.trim()
    return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`
}
