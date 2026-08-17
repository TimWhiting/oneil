import { describe, expect, it } from "vitest"
import {
    isManagedReleaseVersion,
    isPrereleaseVersion,
    MIN_MANAGED_CLI_VERSION,
    normalizeVersionId,
    pickLatestManagedRelease,
} from "../version"

describe("isManagedReleaseVersion", () => {
    it("accepts 1.0.0 and newer", () => {
        expect(isManagedReleaseVersion("1.0.0")).toBe(true)
        expect(isManagedReleaseVersion("v1.0.0")).toBe(true)
        expect(isManagedReleaseVersion("1.0.1")).toBe(true)
        expect(isManagedReleaseVersion("v2.0.0")).toBe(true)
    })

    it("rejects pre-1.0.0 tags (different install scripts)", () => {
        expect(isManagedReleaseVersion("0.3.0")).toBe(false)
        expect(isManagedReleaseVersion("v0.9.9")).toBe(false)
        expect(isManagedReleaseVersion("0.99.0")).toBe(false)
    })

    it("accepts 1.0.0 prereleases so a beta CLI can be installed before the extension ships", () => {
        expect(isManagedReleaseVersion("1.0.0-rc.1")).toBe(true)
        expect(isManagedReleaseVersion("v1.0.0-beta.1")).toBe(true)
        expect(isManagedReleaseVersion("1.0.0-beta.2")).toBe(true)
    })

    it("rejects unparsable tags", () => {
        expect(isManagedReleaseVersion("nightly")).toBe(false)
        expect(isManagedReleaseVersion("")).toBe(false)
    })

    it("uses MIN_MANAGED_CLI_VERSION as the floor", () => {
        expect(MIN_MANAGED_CLI_VERSION).toBe("1.0.0")
        expect(normalizeVersionId("v1.0.0")).toBe(MIN_MANAGED_CLI_VERSION)
    })
})

describe("isPrereleaseVersion", () => {
    it("detects betas from the tag even when GitHub did not mark prerelease", () => {
        expect(isPrereleaseVersion("v1.0.0-beta.4")).toBe(true)
        expect(isPrereleaseVersion("1.0.0-rc.1")).toBe(true)
        expect(isPrereleaseVersion("v1.0.0")).toBe(false)
        expect(isPrereleaseVersion("1.0.1")).toBe(false)
    })
})

describe("pickLatestManagedRelease", () => {
    const tags = (...values: string[]) => values.map((tag) => ({ tag }))

    it("prefers the newest stable 1.x over a newer beta", () => {
        const picked = pickLatestManagedRelease(tags(
            "v1.0.0-beta.4",
            "v1.0.0",
            "v0.16.1",
        ))
        expect(picked?.tag).toBe("v1.0.0")
    })

    it("falls back to the newest 1.x beta when no stable 1.x exists", () => {
        const picked = pickLatestManagedRelease(tags(
            "v1.0.0-beta.2",
            "v1.0.0-beta.4",
            "v1.0.0-beta.3",
            "v0.16.1",
        ))
        expect(picked?.tag).toBe("v1.0.0-beta.4")
    })

    it("returns undefined when only 0.x releases exist", () => {
        expect(pickLatestManagedRelease(tags("v0.16.1", "v0.16.0"))).toBeUndefined()
    })
})
