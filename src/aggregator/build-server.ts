/**
 * Aggregator construction: connect stdio upstreams and register host-facing tools/resources.
 * Implementation lives in {@link ./pipeline.js}.
 */
export {
  attachHostListChangedSubscriptions,
  connectAggregatedHub,
  connectAndProbeWithTimeout,
  createAggregator,
  createMcpAndHub,
  finalizeAggregatorHandle,
  registerAggregatorSurface,
  type AggregatorHandle,
  type PlanConnectProbeOutcome,
} from "./pipeline.js";
