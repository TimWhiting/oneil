import * as vscode from "vscode"
import { LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient/node"
import { openRenderedView, reloadRenderedView } from "./webview/panel"
import { registerImagePathDiagnostics } from "./diagnostics/imagePaths"
import { toggleOfflineMode, isOfflineMode, getCacheDirPath } from "./pdf/cache"
import {
    checkForUpdates,
    installLatestWithProgress,
    resolveCli,
    runActivateCliFlow,
    selectCliVersion,
    shouldRunBackgroundUpdateCheck,
} from "./cli"

let client: LanguageClient | undefined

export async function activate(context: vscode.ExtensionContext) {
    registerImagePathDiagnostics(context)

    // Register commands before any await that can block or throw (install
    // prompt, GitHub, LSP start). Otherwise the palette lists the command
    // from package.json but the handler is missing → "command not found".
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90)
    statusBar.command = "oneil.pdf.toggleOfflineMode"
    statusBar.tooltip = new vscode.MarkdownString(
        "**Oneil PDF mode**\n\nClick to toggle between online (download) and offline (cache only) mode.\n\n" +
        `Cache directory: \`${getCacheDirPath()}\``,
    )
    statusBar.tooltip.isTrusted = true
    updateStatusBar(statusBar)
    statusBar.show()

    context.subscriptions.push(
        statusBar,
        vscode.commands.registerCommand("oneil.restartLanguageServer", () =>
            restartLanguageServer(context),
        ),
        vscode.commands.registerCommand("oneil.openRenderedView", async () => {
            const editor = vscode.window.activeTextEditor
            if (!editor) {
                void vscode.window.showWarningMessage(
                    "Oneil: open a Oneil file before opening the rendered view.",
                )
                return
            }
            if (editor.document.languageId !== "oneil") {
                void vscode.window.showWarningMessage(
                    "Oneil: the active file is not a Oneil file (.on or .one).",
                )
                return
            }
            if (!client) {
                void vscode.window.showWarningMessage(
                    "Oneil: language server is not running.",
                )
                return
            }
            await openRenderedView(editor.document.uri, client, context)
        }),
        vscode.commands.registerCommand("oneil.reloadRenderedView", () =>
            reloadRenderedView(),
        ),
        vscode.commands.registerCommand("oneil.pdf.toggleOfflineMode", async () => {
            await toggleOfflineMode()
            updateStatusBar(statusBar)
        }),
        vscode.commands.registerCommand("oneil.cli.checkForUpdates", () =>
            checkForUpdates(context, restartLanguageServer),
        ),
        vscode.commands.registerCommand("oneil.cli.installOrUpdate", () =>
            installLatestWithProgress(context, restartLanguageServer),
        ),
        vscode.commands.registerCommand("oneil.cli.selectVersion", () =>
            selectCliVersion(context, restartLanguageServer),
        ),
    )

    // Ensure globalStorage exists for managed CLI downloads.
    await vscode.workspace.fs.createDirectory(context.globalStorageUri)

    client?.info("starting language server")
    try {
        const resolved = await runActivateCliFlow(context, restartLanguageServer)
        await restartLanguageServer(context)
        client?.info("language server started")

        const active = resolved ?? (await resolveCli(context))
        if (shouldRunBackgroundUpdateCheck(context, active)) {
            void checkForUpdates(context, restartLanguageServer, { silentIfCurrent: true })
        }
    } catch (error) {
        void vscode.window.showErrorMessage(
            `Oneil: failed to start (${error instanceof Error ? error.message : String(error)})`,
        )
    }

    // Keep the status bar in sync when the setting changes externally.
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("oneil.pdf.offlineOnly")) {
                updateStatusBar(statusBar)
            }

            if (
                e.affectsConfiguration("oneil.serverPath")
                || e.affectsConfiguration("oneil.cacheReadPolicy")
                || e.affectsConfiguration("oneil.cacheWritePolicy")
                || e.affectsConfiguration("oneil.workspaceDiscovery.skipDirs")
                || e.affectsConfiguration("oneil.workspaceDiscovery.disabled")
            ) {
                void restartLanguageServer(context)
            }
        }),
    )

    client?.info("extension is now active!")
}

/** Refreshes the status bar label to reflect the current offline/online mode. */
function updateStatusBar(item: vscode.StatusBarItem): void {
    if (isOfflineMode()) {
        item.text = "$(database) Oneil PDFs: Offline"
        item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
    } else {
        item.text = "$(cloud) Oneil PDFs: Online"
        item.backgroundColor = undefined
    }
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop()
}

/**
 * Builds server and client options from the current Oneil configuration and
 * resolved CLI path.
 */
async function buildOptions(
    context: vscode.ExtensionContext,
): Promise<{ serverOptions: ServerOptions; clientOptions: LanguageClientOptions } | undefined> {
    const config = vscode.workspace.getConfiguration("oneil")
    const resolved = await resolveCli(context)
    if (!resolved) {
        return undefined
    }
    const command = resolved.command

    const cacheReadPolicy = config.get<string>("cacheReadPolicy", "always")
    const cacheWritePolicy = config.get<string>("cacheWritePolicy", "always")
    const skipDirs = config.get<string[]>("workspaceDiscovery.skipDirs", [
        "node_modules",
        "target",
        "venv",
        "__pycache__",
        "__oncache__",
    ])
    const workspaceDiscoveryDisabled = config.get<boolean>("workspaceDiscovery.disabled", false)

    const args = [
        "lsp",
        "--cache-read",
        cacheReadPolicy,
        "--cache-overwrite",
        cacheWritePolicy,
        "--skip-dirs",
        skipDirs.join(","),
    ]

    if (workspaceDiscoveryDisabled) {
        args.push("--disable-workspace-discovery")
    }

    return {
        serverOptions: resolved.env
            ? { command, args, options: { env: resolved.env } }
            : { command, args },
        clientOptions: {
            documentSelector: [
                { scheme: "file", language: "oneil" },
                { scheme: "file", language: "python" },
            ],
        },
    }
}

/**
 * Restarts the Oneil language server. Uses the current configuration and
 * resolved CLI (managed install, PATH, or `oneil.serverPath`).
 */
async function restartLanguageServer(context: vscode.ExtensionContext): Promise<void> {
    if (client != null) {
        client.info("restarting language server")
        await client.stop()
        client = undefined
    }

    const options = await buildOptions(context)
    if (!options) {
        void vscode.window.showWarningMessage(
            "Oneil: CLI not found. Use “Oneil: Install or Update CLI” or set `oneil.serverPath`.",
        )
        return
    }

    const { serverOptions, clientOptions } = options

    const newClient = new LanguageClient(
        "oneil-language-server",
        "Oneil Language Server",
        serverOptions,
        clientOptions,
    )
    await newClient.start()

    client = newClient
    client.info("language server initialized")
}
