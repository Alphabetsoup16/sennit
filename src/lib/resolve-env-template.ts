/** Replace `${VAR}` placeholders with environment values (missing vars become empty string). */
export function resolveEnvTemplate(input: string, env: Record<string, string>): string {
  return input.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_m, key: string) => env[key] ?? "");
}

export function resolveHeaderTemplates(
  headers: Record<string, string> | undefined,
  env: Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, resolveEnvTemplate(v, env)]));
}
