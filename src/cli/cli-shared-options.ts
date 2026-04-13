/**
 * Single source of truth for repeated Commander option flags and help text.
 * Keeps `serve`, `plan`, `doctor inspect`, `config print`, etc. aligned.
 */

export const OPT_CONFIG_PATH = "-c, --config <path>";

/** Use when `-c` is optional and defaults via {@link resolveConfigPath}. */
export const DESC_CONFIG_PATH_RESOLVE =
  "Config path (default: same resolution as `serve`)";

/** Use when `-c` is required (explicit file path only). */
export const DESC_CONFIG_PATH_REQUIRED = "Path to config file";

export const OPT_JSON = "--json";

export const DESC_JSON = "Machine-readable output";

export const OPT_TIMEOUT_MS = "--timeout <ms>";

export const DESC_TIMEOUT_INSPECT =
  "Wall-clock timeout for the upstream inspect phase (milliseconds)";
