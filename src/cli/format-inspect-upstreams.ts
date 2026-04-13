import type { DoctorInspectUpstream } from "./inspect-upstreams.js";

export type FormatInspectUpstreamsOpts = {
  fatalError?: string;
};

/** Indented lines for `plan` / `doctor inspect` human output. */
export function formatInspectUpstreamsHumanLines(
  upstreams: readonly DoctorInspectUpstream[],
  opts: FormatInspectUpstreamsOpts = {},
): string[] {
  const lines: string[] = [];
  if (opts.fatalError) {
    lines.push(`  fatal: ${opts.fatalError}`);
  }
  for (const u of upstreams) {
    if (u.ok) {
      const resPart = u.resourceCount !== undefined ? `; ${u.resourceCount} resources` : "";
      lines.push(
        `  ${u.serverKey}: ok (${u.toolCount ?? 0} tools${resPart}) — ${(u.toolNames ?? []).join(", ") || "(none)"}`,
      );
    } else {
      lines.push(`  ${u.serverKey}: error — ${u.error ?? "unknown"}`);
    }
  }
  if (upstreams.length === 0 && !opts.fatalError) {
    lines.push("  (no upstream servers configured)");
  }
  return lines;
}
