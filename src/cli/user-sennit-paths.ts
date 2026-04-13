import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Per-user directory for Sennit config (e.g. `.../sennit/config.yaml`).
 * Honors `XDG_CONFIG_HOME` when set (all platforms).
 */
export function userSennitConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.length > 0) {
    return join(xdg, "sennit");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "sennit");
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData && appData.length > 0) {
      return join(appData, "sennit");
    }
    return join(homedir(), "AppData", "Roaming", "sennit");
  }
  return join(homedir(), ".config", "sennit");
}

/** Default per-user config file (`config.yaml` under {@link userSennitConfigDir}). */
export function defaultUserSennitConfigFile(): string {
  return join(userSennitConfigDir(), "config.yaml");
}

/** One line + newline, for `sennit config path`. */
export function writeDefaultUserConfigPathToStdout(): void {
  process.stdout.write(`${defaultUserSennitConfigFile()}\n`);
}

