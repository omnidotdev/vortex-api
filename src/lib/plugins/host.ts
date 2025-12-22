/**
 * Extism Plugin Host
 *
 * Manages loading, execution, and lifecycle of WASM plugins.
 */

import type {
  LoadedPlugin,
  PluginExecutionOptions,
  PluginExecutionResult,
  PluginHost,
  PluginManifest,
  PluginRegistryEntry,
} from "./types";

// Note: In production, import from @extism/extism
// import Extism from "@extism/extism";

/**
 * Plugin cache entry with metadata.
 */
interface CacheEntry {
  plugin: LoadedPlugin;
  loadedAt: Date;
  lastUsedAt: Date;
  useCount: number;
}

/**
 * Host configuration options.
 */
export interface HostOptions {
  /** Maximum number of plugins to keep in cache */
  maxCacheSize?: number;
  /** Default timeout for plugin execution (ms) */
  defaultTimeout?: number;
  /** Default memory limit (bytes) */
  defaultMemoryLimit?: number;
  /** Function to fetch plugin registry entry from database */
  fetchPlugin: (pluginId: string) => Promise<PluginRegistryEntry | null>;
}

/**
 * Create a new plugin host instance.
 */
export function createPluginHost(options: HostOptions): PluginHost {
  const cache = new Map<string, CacheEntry>();
  const maxCacheSize = options.maxCacheSize ?? 50;

  /**
   * Evict least recently used plugins if cache is full.
   */
  function evictIfNeeded(): void {
    if (cache.size < maxCacheSize) return;

    // Find LRU entry
    let lruId: string | null = null;
    let lruTime = Date.now();

    for (const [id, entry] of cache.entries()) {
      if (entry.lastUsedAt.getTime() < lruTime) {
        lruTime = entry.lastUsedAt.getTime();
        lruId = id;
      }
    }

    if (lruId) {
      const entry = cache.get(lruId);
      if (entry) {
        entry.plugin.unload();
        cache.delete(lruId);
      }
    }
  }

  /**
   * Verify WASM binary hash.
   */
  async function verifyHash(
    data: ArrayBuffer,
    expectedHash: string,
  ): Promise<boolean> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex === expectedHash;
  }

  /**
   * Load a plugin by ID.
   */
  async function loadPlugin(pluginId: string): Promise<LoadedPlugin> {
    // Check cache first
    const cached = cache.get(pluginId);
    if (cached) {
      cached.lastUsedAt = new Date();
      cached.useCount++;
      return cached.plugin;
    }

    // Fetch plugin from database
    const pluginEntry = await options.fetchPlugin(pluginId);
    if (!pluginEntry) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (!pluginEntry.isEnabled) {
      throw new Error(`Plugin is disabled: ${pluginId}`);
    }

    // Download WASM binary
    const response = await fetch(pluginEntry.wasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to download plugin WASM: ${response.statusText}`);
    }

    const wasmBytes = await response.arrayBuffer();

    // Verify hash
    const hashValid = await verifyHash(wasmBytes, pluginEntry.wasmHash);
    if (!hashValid) {
      throw new Error(`Plugin WASM hash mismatch: ${pluginId}`);
    }

    const manifest = pluginEntry.manifest;

    // Create plugin instance
    // Note: This is a placeholder. In production, use actual Extism SDK:
    // const extismPlugin = await Extism.Plugin.fromBytes(new Uint8Array(wasmBytes), {
    //   useWasi: manifest.runtime.wasi,
    //   allowedHosts: manifest.runtime.allowedHosts,
    //   runInWorker: true,
    //   config: pluginEntry.config,
    // });

    const loadedPlugin: LoadedPlugin = {
      id: pluginId,
      manifest,
      call: async (functionName, input, execOptions) => {
        return executeFunction(
          manifest,
          functionName,
          input,
          pluginEntry.config,
          execOptions,
        );
      },
      unload: async () => {
        cache.delete(pluginId);
        // In production: await extismPlugin.close();
      },
    };

    // Add to cache
    evictIfNeeded();
    cache.set(pluginId, {
      plugin: loadedPlugin,
      loadedAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 1,
    });

    return loadedPlugin;
  }

  /**
   * Execute a function on a plugin.
   */
  async function executeFunction(
    manifest: PluginManifest,
    functionName: string,
    input: unknown,
    config: Record<string, unknown>,
    options?: PluginExecutionOptions,
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();

    try {
      // Validate function exists
      const funcDef = manifest.functions.find((f) => f.name === functionName);
      if (!funcDef) {
        throw new Error(`Function not found: ${functionName}`);
      }

      // Execute with timeout
      // Note: In production, this would call the actual Extism plugin:
      // const resultPromise = extismPlugin.call(functionName, inputJson);
      // const result = await Promise.race([
      //   resultPromise,
      //   new Promise((_, reject) =>
      //     setTimeout(() => reject(new Error("Plugin timeout")), timeout)
      //   ),
      // ]);

      // Placeholder: simulate plugin execution
      const result = await simulatePluginExecution(functionName, input, config);

      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        output: result,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs,
      };
    }
  }

  /**
   * Placeholder function to simulate plugin execution.
   * In production, this would be replaced by actual Extism calls.
   */
  async function simulatePluginExecution(
    functionName: string,
    input: unknown,
    _config: Record<string, unknown>,
  ): Promise<unknown> {
    // This is a placeholder. Real implementation would execute WASM.
    return {
      functionName,
      input,
      timestamp: new Date().toISOString(),
      message: "Plugin execution simulated (Extism not configured)",
    };
  }

  /**
   * Call a function on a plugin by ID.
   */
  async function callFunction(
    pluginId: string,
    functionName: string,
    input: unknown,
    options?: PluginExecutionOptions,
  ): Promise<PluginExecutionResult> {
    const plugin = await loadPlugin(pluginId);
    return plugin.call(functionName, input, options);
  }

  /**
   * Unload a plugin from memory.
   */
  async function unloadPlugin(pluginId: string): Promise<void> {
    const cached = cache.get(pluginId);
    if (cached) {
      await cached.plugin.unload();
    }
  }

  /**
   * Clear all loaded plugins.
   */
  async function clearAll(): Promise<void> {
    for (const [, entry] of cache.entries()) {
      await entry.plugin.unload();
    }
    cache.clear();
  }

  return {
    loadPlugin,
    callFunction,
    unloadPlugin,
    clearAll,
  };
}

/**
 * Validate plugin manifest.
 */
export function validateManifest(
  manifest: unknown,
): manifest is PluginManifest {
  if (!manifest || typeof manifest !== "object") return false;

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (typeof m.name !== "string" || !m.name) return false;
  if (typeof m.version !== "string" || !m.version) return false;
  if (typeof m.description !== "string") return false;
  if (typeof m.author !== "string") return false;

  // Runtime
  if (!m.runtime || typeof m.runtime !== "object") return false;
  const runtime = m.runtime as Record<string, unknown>;
  if (typeof runtime.wasi !== "boolean") return false;

  // Functions
  if (!Array.isArray(m.functions)) return false;
  for (const func of m.functions) {
    if (typeof func !== "object" || !func) return false;
    const f = func as Record<string, unknown>;
    if (typeof f.name !== "string" || !f.name) return false;
    if (typeof f.description !== "string") return false;
    if (!f.inputs || typeof f.inputs !== "object") return false;
    if (!f.outputs || typeof f.outputs !== "object") return false;
  }

  return true;
}
