/**
 * Joins a relative path onto a webview base URI.
 *
 * A leading `./` is stripped so `./foo.png` and `foo.png` resolve the same way.
 */
export function joinWebviewBase(base: string, relPath: string): string {
    const normalized = relPath.replace(/^\.\//, "")
    return `${base.replace(/\/$/, "")}/${normalized}`
}

export type ResolvedAsset = {
    /** URL to try first. */
    primary: string
    /** Alternate URL when `primary` is missing. `null` when there is only one candidate. */
    fallback: string | null
}

/**
 * Resolves a note or citation path for the webview.
 *
 * Order:
 * 1. Remote / data URLs — returned as-is.
 * 2. Paths starting with `/` — workspace root only.
 * 3. Relative paths (`./…` or bare) — model-file directory first, then workspace root.
 */
export function resolveRelativeAsset(
    src: string,
    fileBaseUri: string | null,
    workspaceUri: string | null,
): ResolvedAsset {
    if (/^(https?:|data:)/i.test(src)) {
        return { primary: src, fallback: null }
    }
    if (src.startsWith("/")) {
        const path = src.replace(/^\//, "")
        if (workspaceUri) return { primary: joinWebviewBase(workspaceUri, path), fallback: null }
        return { primary: src, fallback: null }
    }
    const normalized = src.replace(/^\.\//, "")
    if (fileBaseUri && workspaceUri) {
        const fileUrl = joinWebviewBase(fileBaseUri, normalized)
        const workspaceUrl = joinWebviewBase(workspaceUri, normalized)
        return fileUrl === workspaceUrl
            ? { primary: fileUrl, fallback: null }
            : { primary: fileUrl, fallback: workspaceUrl }
    }
    if (fileBaseUri) return { primary: joinWebviewBase(fileBaseUri, normalized), fallback: null }
    if (workspaceUri) return { primary: joinWebviewBase(workspaceUri, normalized), fallback: null }
    return { primary: src, fallback: null }
}

/**
 * Builds an inline PDF URL from a BibTeX `file` field.
 *
 * Bare names go to the PDF cache. `./` / `../` use model-directory-first
 * resolution. Absolute and `~` paths return `null` so the extension can resolve them.
 */
export function resolveInlinePdfUrl(
    cachePath: string,
    bases: {
        pdfCacheUri: string | null
        fileBaseUri: string | null
        workspaceUri: string | null
    },
): ResolvedAsset | null {
    const isBare = !cachePath.startsWith("/") && !cachePath.startsWith("~") &&
        !cachePath.startsWith("./") && !cachePath.startsWith("../")
    if (isBare) {
        if (!bases.pdfCacheUri) return null
        return { primary: joinWebviewBase(bases.pdfCacheUri, cachePath), fallback: null }
    }
    if (cachePath.startsWith("./") || cachePath.startsWith("../")) {
        return resolveRelativeAsset(cachePath, bases.fileBaseUri, bases.workspaceUri)
    }
    return null
}
