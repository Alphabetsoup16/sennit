import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SennitConfig } from "../config/schema.js";

function safeSignal(send: () => void): void {
  try {
    send();
  } catch {
    /* host disconnected */
  }
}

/**
 * Fanout for upstream list-changed notifications to every connected host session (HTTP)
 * or the single stdio session.
 */
export class HostListChangedFanout {
  private readonly toolListeners = new Set<() => void>();
  private readonly resourceListeners = new Set<() => void>();
  private readonly promptListeners = new Set<() => void>();

  subscribeTools(fn: () => void): () => void {
    this.toolListeners.add(fn);
    return () => {
      this.toolListeners.delete(fn);
    };
  }

  subscribeResources(fn: () => void): () => void {
    this.resourceListeners.add(fn);
    return () => {
      this.resourceListeners.delete(fn);
    };
  }

  subscribePrompts(fn: () => void): () => void {
    this.promptListeners.add(fn);
    return () => {
      this.promptListeners.delete(fn);
    };
  }

  signalHostToolListChanged(): void {
    for (const fn of this.toolListeners) {
      safeSignal(fn);
    }
  }

  signalHostResourceListChanged(): void {
    for (const fn of this.resourceListeners) {
      safeSignal(fn);
    }
  }

  signalHostPromptListChanged(): void {
    for (const fn of this.promptListeners) {
      safeSignal(fn);
    }
  }
}

/** Wire dynamic list notifications to this host session; call the returned unsub on session close. */
export function attachHostListChangedSubscriptions(
  mcp: McpServer,
  fanout: HostListChangedFanout,
  config: SennitConfig,
): () => void {
  const unsubs: Array<() => void> = [];
  if (config.dynamicToolList) {
    unsubs.push(
      fanout.subscribeTools(() => {
        safeSignal(() => mcp.sendToolListChanged());
      }),
    );
  }
  if (config.dynamicResourceList) {
    unsubs.push(
      fanout.subscribeResources(() => {
        safeSignal(() => mcp.sendResourceListChanged());
      }),
    );
  }
  if (config.dynamicPromptList) {
    unsubs.push(
      fanout.subscribePrompts(() => {
        safeSignal(() => mcp.sendPromptListChanged());
      }),
    );
  }
  return () => {
    for (const u of unsubs) {
      u();
    }
  };
}
