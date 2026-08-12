/**
 * Resolve which Oneil CLI binary the extension should spawn.
 *
 * Precedence: `oneil.serverPath` → managed globalStorage binary → `ONEIL_PATH` → `oneil` on PATH.
 */

import { access } from "fs/promises"
import { constants as fsConstants } from "fs"
import { execFile } from "child_process"
import { promisify } from "util"
import * as vscode from "vscode"

import { managedBinaryExists, managedBinaryPath } from "./install"
import { parseVersionOutput } from "./version"

const execFileAsync = promisify(execFile)

export type ResolvedCli = {
    /** Absolute path or command name to spawn. */
    command: string
    /** Where the command came from. */
    source: "serverPath" | "managed" | "env" | "path"
}

/**
 * Resolves the CLI command according to extension precedence rules.
 */
export async function resolveCli(context: vscode.ExtensionContext): Promise<ResolvedCli | undefined> {
    const config = vscode.workspace.getConfiguration("oneil")
    const serverPath = config.get<string | null>("serverPath", null)
    if (serverPath && serverPath.trim() !== "") {
        return { command: serverPath.trim(), source: "serverPath" }
    }

    if (await managedBinaryExists(context)) {
        const command = managedBinaryPath(context)
        if (command) {
            return { command, source: "managed" }
        }
    }

    const envPath = process.env.ONEIL_PATH
    if (envPath && envPath.trim() !== "") {
        return { command: envPath.trim(), source: "env" }
    }

    if (await commandExistsOnPath("oneil")) {
        return { command: "oneil", source: "path" }
    }

    return undefined
}

/**
 * Runs `<command> --version` and returns the normalized version id.
 */
export async function readCliVersion(command: string): Promise<string | undefined> {
    try {
        const { stdout } = await execFileAsync(command, ["--version"], {
            timeout: 10_000,
            windowsHide: true,
        })
        return parseVersionOutput(stdout)
    } catch {
        return undefined
    }
}

async function commandExistsOnPath(command: string): Promise<boolean> {
    if (command.includes("/") || command.includes("\\")) {
        try {
            await access(command, fsConstants.X_OK)
            return true
        } catch {
            try {
                await access(command, fsConstants.F_OK)
                return true
            } catch {
                return false
            }
        }
    }

    try {
        await execFileAsync(command, ["--version"], { timeout: 5_000, windowsHide: true })
        return true
    } catch {
        return false
    }
}
