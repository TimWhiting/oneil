/**
 * Parse and compare Oneil CLI version ids from `oneil --version` and GitHub tags.
 * Uses the `semver` package for canonical version identity.
 */

import semver from "semver"

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
