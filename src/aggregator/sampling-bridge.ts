import type { CreateMessageRequest, CreateMessageResult, CreateMessageResultWithTools } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { getActiveHostMcp } from "../lib/active-host-mcp.js";
import { errorMessage } from "../lib/error-message.js";

/**
 * Forwards upstream `sampling/createMessage` to the **host** MCP client via the facade
 * {@link McpServer}'s underlying `Server` (same pattern as {@link ./roots-bridge.js}).
 */
export type UpstreamSamplingBridge = {
  forwardCreateMessage: (
    params: CreateMessageRequest["params"],
  ) => Promise<CreateMessageResult | CreateMessageResultWithTools>;
};

export function makeUpstreamSamplingBridge(): UpstreamSamplingBridge {
  return {
    forwardCreateMessage: async (params) => {
      const mcp = getActiveHostMcp();
      if (!mcp) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "No active host MCP session for sampling (declare client capabilities.sampling).",
        );
      }
      try {
        return await mcp.server.createMessage(params);
      } catch (e) {
        const msg = errorMessage(e);
        const hostUnsupported =
          (e instanceof McpError && e.code === ErrorCode.MethodNotFound) ||
          msg.includes("does not support sampling") ||
          msg.includes("Method not found") ||
          msg.includes("method not found");
        if (hostUnsupported) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Host client does not support MCP sampling (declare client capabilities.sampling). ${msg}`,
          );
        }
        throw new McpError(ErrorCode.InternalError, msg);
      }
    },
  };
}
