import { afterEach, describe, expect, it, vi } from "vitest"
import {
    cacheFilename,
    fetchPdfBytes,
    isPdfBuffer,
    portableCachePathFrom,
    updateBibText,
} from "../cacheLogic"

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]) // %PDF-1.4
const HTML_BYTES = new TextEncoder().encode("<html><body>landing page</body></html>")

describe("cacheFilename", () => {
    it("is deterministic for the same url and title", () => {
        const a = cacheFilename("https://ex.com/a.pdf", "NASA STD 3001")
        const b = cacheFilename("https://ex.com/a.pdf", "NASA STD 3001")
        expect(a).toBe(b)
        expect(a).toMatch(/^nasa-std-3001_[0-9a-f]{8}\.pdf$/)
    })

    it("changes the hash when the url changes, even if the title is the same", () => {
        const a = cacheFilename("https://ex.com/a.pdf", "Same Title")
        const b = cacheFilename("https://ex.com/b.pdf", "Same Title")
        expect(a).not.toBe(b)
        expect(a.split("_")[0]).toBe(b.split("_")[0])
    })

    it("uses pdf as the prefix when the title is empty", () => {
        expect(cacheFilename("https://ex.com/a.pdf", "")).toMatch(/^pdf_[0-9a-f]{8}\.pdf$/)
    })

    it("truncates a long title to 48 sanitized characters", () => {
        const title = "A".repeat(80)
        const name = cacheFilename("https://ex.com/a.pdf", title)
        const prefix = name.slice(0, name.lastIndexOf("_"))
        expect(prefix.length).toBe(48)
    })
})

describe("isPdfBuffer", () => {
    it("accepts a %PDF- header", () => {
        expect(isPdfBuffer(PDF_BYTES)).toBe(true)
    })

    it("rejects HTML and short buffers", () => {
        expect(isPdfBuffer(HTML_BYTES)).toBe(false)
        expect(isPdfBuffer(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(false)
        expect(isPdfBuffer(new Uint8Array())).toBe(false)
    })
})

describe("portableCachePathFrom", () => {
    it("returns only the filename when the path is inside the cache dir", () => {
        expect(portableCachePathFrom("/home/u/.local/oneil/resources/paper_abc.pdf", "/home/u/.local/oneil/resources"))
            .toBe("paper_abc.pdf")
    })

    it("returns the absolute path when the file is outside the cache dir", () => {
        expect(portableCachePathFrom("/repo/papers/nasa.pdf", "/home/u/.local/oneil/resources"))
            .toBe("/repo/papers/nasa.pdf")
    })
})

describe("updateBibText", () => {
    const bib = `@article{Kalinin2021,
  author  = {Kalinin, M. I.},
  title   = {Angular frequency},
  year    = {2021},
  doi     = {10.1088/1681-7575/ac0240},
}
`

    it("inserts a file field before the closing brace", () => {
        const updated = updateBibText(bib, "Kalinin2021", "paper_abc.pdf")
        expect(updated).toContain("  file = {:paper_abc.pdf:PDF},")
        expect(updated).toContain("doi     = {10.1088/1681-7575/ac0240},")
    })

    it("replaces an existing file field", () => {
        const withFile = `@techreport{NASA-STD-3001,
  title = {Crew Health},
  file = {:old.pdf:PDF},
}
`
        const updated = updateBibText(withFile, "NASA-STD-3001", "new.pdf")
        expect(updated).toContain("file = {:new.pdf:PDF}")
        expect(updated).not.toContain("old.pdf")
    })

    it("does not confuse nested braces in other fields", () => {
        const nested = `@book{ONeill1977,
  author = {{O'Neill, Gerard K.}},
  title  = {The High Frontier},
}
`
        const updated = updateBibText(nested, "ONeill1977", "hf.pdf")
        expect(updated).toContain("author = {{O'Neill, Gerard K.}},")
        expect(updated).toContain("  file = {:hf.pdf:PDF},")
        expect(updated.trim().endsWith("}")).toBe(true)
    })

    it("throws when the key is missing", () => {
        expect(() => updateBibText(bib, "Missing", "x.pdf")).toThrow(/@Missing not found/)
    })

    it("throws when the entry is unclosed", () => {
        expect(() => updateBibText("@article{Open,\n  title = {x},\n", "Open", "x.pdf"))
            .toThrow(/closing brace/)
    })
})

describe("fetchPdfBytes", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    function stubFetch(init: { ok: boolean; status?: number; statusText?: string; body: Uint8Array; contentType?: string }) {
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: init.ok,
            status: init.status ?? (init.ok ? 200 : 404),
            statusText: init.statusText ?? (init.ok ? "OK" : "Not Found"),
            headers: new Headers({ "content-type": init.contentType ?? "application/pdf" }),
            arrayBuffer: async () => init.body.buffer.slice(init.body.byteOffset, init.body.byteOffset + init.body.byteLength),
        })))
    }

    it("returns the body when the response is a PDF", async () => {
        stubFetch({ ok: true, body: PDF_BYTES })
        const bytes = await fetchPdfBytes("https://ex.com/a.pdf")
        expect(isPdfBuffer(bytes)).toBe(true)
        expect(bytes.byteLength).toBe(PDF_BYTES.byteLength)
    })

    it("rejects an HTML DOI landing page instead of caching it as a PDF", async () => {
        stubFetch({ ok: true, body: HTML_BYTES, contentType: "text/html" })
        await expect(fetchPdfBytes("https://doi.org/10.1088/1681-7575/ac0240"))
            .rejects.toThrow(/Not a PDF/)
    })

    it("rejects a non-OK HTTP status", async () => {
        stubFetch({ ok: false, status: 404, statusText: "Not Found", body: HTML_BYTES, contentType: "text/html" })
        await expect(fetchPdfBytes("https://ex.com/missing.pdf"))
            .rejects.toThrow(/HTTP 404/)
    })

    it("wraps a network failure", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => {
            throw new TypeError("fetch failed")
        }))
        await expect(fetchPdfBytes("https://ex.com/a.pdf"))
            .rejects.toThrow(/Network error fetching PDF/)
    })
})
