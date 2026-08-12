/**
 * VS Code `globalState` keys for CLI update bookkeeping.
 * Active version always comes from `oneil --version`, not from these keys.
 */

import type * as vscode from "vscode"

export const STATE_LAST_UPDATE_CHECK = "oneil.cli.lastUpdateCheck"
export const STATE_SKIPPED_VERSION = "oneil.cli.skippedVersion"

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * True when an automatic update check should run (throttled to once per day).
 */
export function shouldAutoCheckUpdates(context: vscode.ExtensionContext): boolean {
    const last = context.globalState.get<number>(STATE_LAST_UPDATE_CHECK)
    if (last == null) {
        return true
    }
    return Date.now() - last >= ONE_DAY_MS
}

/**
 * Marks that an update check just ran.
 */
export async function markUpdateChecked(context: vscode.ExtensionContext): Promise<void> {
    await context.globalState.update(STATE_LAST_UPDATE_CHECK, Date.now())
}

/**
 * Version the user chose to skip in the update prompt (normalized semver id).
 */
export function getSkippedVersion(context: vscode.ExtensionContext): string | undefined {
    return context.globalState.get<string>(STATE_SKIPPED_VERSION)
}

/**
 * Persists a skipped release version id (normalized semver id).
 */
export async function setSkippedVersion(
    context: vscode.ExtensionContext,
    version: string | undefined,
): Promise<void> {
    await context.globalState.update(STATE_SKIPPED_VERSION, version)
}
