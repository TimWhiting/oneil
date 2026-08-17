/**
 * Extension-managed Oneil CLI install / update / version selection.
 */

export { resolveCliPlatform, SUPPORTED_PLATFORMS_LABEL } from "./platforms"
export { resolveCli, readCliVersion } from "./resolve"
export { managedBinaryPath, managedBinaryExists, installCliRelease, installCliTag } from "./install"
export {
    runActivateCliFlow,
    checkForUpdates,
    installLatestWithProgress,
    selectCliVersion,
    shouldRunBackgroundUpdateCheck,
} from "./update"
export { parseVersionOutput, normalizeVersionId, versionsEqual, isNewerVersion } from "./version"
