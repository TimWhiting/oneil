import { describe, expect, it } from "vitest"
import { loadParsedBibliography, normalizeDoi } from "../bibliography"

const BIB = `
@article{Kalinin2021,
  author  = {Kalinin, M. I.},
  title   = {Angular frequency in the International System of Units},
  journal = {Metrologia},
  year    = {2021},
  doi     = {10.1088/1681-7575/ac0240},
}

@article{UrlForm,
  author = {Someone},
  title  = {URL-shaped DOI},
  year   = {2020},
  doi    = {https://doi.org/10.1088/1681-7575/ac0240},
}

@article{DoiPrefix,
  author = {Someone},
  title  = {doi: prefix},
  year   = {2020},
  doi    = {doi:10.1088/1681-7575/ac0240},
}

@article{Both,
  author = {Someone},
  title  = {Has url and doi},
  year   = {2020},
  url    = {https://example.com/paper.pdf},
  doi    = {10.1088/1681-7575/ac0240},
}
`

describe("BibTeX doi field parsing", () => {
    it("extracts a bare doi identifier", async () => {
        const map = await loadParsedBibliography(BIB)
        const entry = map.get("Kalinin2021")
        expect(entry).toBeDefined()
        expect(entry?.doi).toBe("10.1088/1681-7575/ac0240")
        expect(entry?.url).toBeUndefined()
    })

    it("keeps url and doi as separate fields when both are present", async () => {
        const map = await loadParsedBibliography(BIB)
        const entry = map.get("Both")
        expect(entry?.url).toBe("https://example.com/paper.pdf")
        expect(entry?.doi).toBe("10.1088/1681-7575/ac0240")
    })

    it("strips https://doi.org/ and doi: prefixes to a bare identifier", async () => {
        const map = await loadParsedBibliography(BIB)
        expect(map.get("UrlForm")?.doi).toBe("10.1088/1681-7575/ac0240")
        expect(map.get("DoiPrefix")?.doi).toBe("10.1088/1681-7575/ac0240")
    })
})

describe("normalizeDoi", () => {
    it.each([
        ["10.1088/1681-7575/ac0240", "10.1088/1681-7575/ac0240"],
        ["https://doi.org/10.1088/1681-7575/ac0240", "10.1088/1681-7575/ac0240"],
        ["http://dx.doi.org/10.1088/1681-7575/ac0240", "10.1088/1681-7575/ac0240"],
        ["doi:10.1088/1681-7575/ac0240", "10.1088/1681-7575/ac0240"],
        ["doi: 10.1088/1681-7575/ac0240", "10.1088/1681-7575/ac0240"],
        [undefined, undefined],
        ["", undefined],
    ])("normalizeDoi(%s) → %s", (input, expected) => {
        expect(normalizeDoi(input)).toBe(expected)
    })
})
