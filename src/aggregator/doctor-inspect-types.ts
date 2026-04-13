/** Shared with CLI plan/inspect output (no dependency on Commander). */

export type DoctorInspectUpstream = {
  serverKey: string;
  ok: boolean;
  error?: string;
  toolCount?: number;
  toolNames?: string[];
  /** Present when upstream advertises prompts and listing succeeded. */
  promptCount?: number;
  promptNames?: string[];
  /** Present when upstream supports `resources/list` and listing succeeded. */
  resourceCount?: number;
};

export type DoctorInspectResult = {
  schemaVersion: 1;
  ok: boolean;
  /** Set when connect or overall deadline fails (not per-upstream list errors). */
  fatalError?: string;
  upstreams: DoctorInspectUpstream[];
};
