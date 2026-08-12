import { describe, expect, it } from "vitest"
import { joinWebviewBase, resolveInlinePdfUrl, resolveRelativeAsset } from "../resolveAssetUrl"

const fileBase = "https://webview/file"
const workspace = "https://webview/workspace"

describe("joinWebviewBase", () => {
    it("strips a trailing slash on the base and a leading ./ on the path", () => {
        expect(joinWebviewBase("https://webview/file/", "./img/a.png")).toBe("https://webview/file/img/a.png")
    })
})

describe("resolveRelativeAsset", () => {
    it("leaves remote and data URLs unchanged", () => {
        expect(resolveRelativeAsset("https://ex.com/a.png", fileBase, workspace)).toEqual({
            primary: "https://ex.com/a.png",
            fallback: null,
        })
        expect(resolveRelativeAsset("data:image/png;base64,xx", fileBase, workspace)).toEqual({
            primary: "data:image/png;base64,xx",
            fallback: null,
        })
    })

    it("resolves /paths against the workspace root only", () => {
        expect(resolveRelativeAsset("/images/a.png", fileBase, workspace)).toEqual({
            primary: "https://webview/workspace/images/a.png",
            fallback: null,
        })
    })

    it("resolves relative paths against the model directory first", () => {
        expect(resolveRelativeAsset("./diagram.png", fileBase, workspace)).toEqual({
            primary: "https://webview/file/diagram.png",
            fallback: "https://webview/workspace/diagram.png",
        })
        expect(resolveRelativeAsset("images/a.png", fileBase, workspace)).toEqual({
            primary: "https://webview/file/images/a.png",
            fallback: "https://webview/workspace/images/a.png",
        })
    })

    it("omits a fallback when the two bases are the same", () => {
        expect(resolveRelativeAsset("./a.png", workspace, workspace)).toEqual({
            primary: "https://webview/workspace/a.png",
            fallback: null,
        })
    })

    it("falls back to whichever base is available", () => {
        expect(resolveRelativeAsset("./a.png", fileBase, null)).toEqual({
            primary: "https://webview/file/a.png",
            fallback: null,
        })
        expect(resolveRelativeAsset("./a.png", null, workspace)).toEqual({
            primary: "https://webview/workspace/a.png",
            fallback: null,
        })
    })
})

describe("resolveInlinePdfUrl", () => {
    const bases = { pdfCacheUri: "https://webview/cache", fileBaseUri: fileBase, workspaceUri: workspace }

    it("maps a bare filename to the PDF cache", () => {
        expect(resolveInlinePdfUrl("paper.pdf", bases)).toEqual({
            primary: "https://webview/cache/paper.pdf",
            fallback: null,
        })
    })

    it("resolves ./ paths against the model directory first", () => {
        expect(resolveInlinePdfUrl("./papers/a.pdf", bases)).toEqual({
            primary: "https://webview/file/papers/a.pdf",
            fallback: "https://webview/workspace/papers/a.pdf",
        })
    })

    it("leaves absolute and ~ paths to the extension", () => {
        expect(resolveInlinePdfUrl("/tmp/a.pdf", bases)).toBeNull()
        expect(resolveInlinePdfUrl("~/a.pdf", bases)).toBeNull()
    })
})
