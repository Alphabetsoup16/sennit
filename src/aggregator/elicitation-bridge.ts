import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ElicitRequest, ElicitRequestFormParams, ElicitRequestURLParams, ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { errorMessage } from "../lib/error-message.js";

/**
 * Forwards upstream `elicitation/create` to the **host** MCP client (same pattern as
 * {@link ./sampling-bridge.js}).
 */
export type UpstreamElicitationBridge = {
  forwardElicit: (params: ElicitRequest["params"]) => Promise<ElicitResult>;
};

export function makeUpstreamElicitationBridge(mcp: McpServer): UpstreamElicitationBridge {
  return {
    forwardElicit: async (params) => {
      try {
        return await mcp.server.elicitInput(params as ElicitRequestFormParams | ElicitRequestURLParams);
      } catch (e) {
        const msg = errorMessage(e);
        const hostUnsupported =
          (e instanceof McpError && e.code === ErrorCode.MethodNotFound) ||
          msg.includes("does not support elicitation") ||
          msg.includes("does not support form elicitation") ||
          msg.includes("does not support url elicitation") ||
          msg.includes("does not support URL elicitation") ||
          msg.includes("elicitation capability") ||
          msg.includes("Method not found") ||
          msg.includes("method not found");
        if (hostUnsupported) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Host client does not support MCP elicitation (declare client capabilities.elicitation). ${msg}`,
          );
        }
        throw new McpError(ErrorCode.InternalError, msg);
      }
    },
  };
}
