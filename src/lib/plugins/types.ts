/**
 * Extism Plugin Types
 *
 * Type definitions for the Extism WASM plugin system.
 */

/**
 * JSON Schema type for plugin manifest.
 */
export interface JSONSchemaType {
  type:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "object"
    | "array"
    | "null";
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: JSONSchemaType;
  properties?: Record<string, JSONSchemaType>;
  required?: string[];
  additionalProperties?: boolean | JSONSchemaType;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

/**
 * Plugin function definition.
 */
export interface PluginFunction {
  /** Function name (exported from WASM) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Input schema */
  inputs: {
    type: "object";
    properties: Record<string, JSONSchemaType>;
    required?: string[];
  };
  /** Output schema */
  outputs: {
    type: "object";
    properties: Record<string, JSONSchemaType>;
  };
}

/**
 * Plugin runtime configuration.
 */
export interface PluginRuntime {
  /** Enable WASI support */
  wasi: boolean;
  /** Allowed HTTP hosts the plugin can access */
  allowedHosts?: string[];
  /** Maximum memory in bytes */
  memoryLimit?: number;
  /** Maximum execution time in milliseconds */
  timeout?: number;
}

/**
 * Plugin manifest format.
 * This is stored in the database and defines the plugin's interface.
 */
export interface PluginManifest {
  /** Plugin name */
  name: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description: string;
  /** Plugin author */
  author: string;
  /** Homepage/documentation URL */
  homepage?: string;
  /** License identifier (SPDX) */
  license?: string;
  /** Runtime configuration */
  runtime: PluginRuntime;
  /** Exported functions */
  functions: PluginFunction[];
  /** User configuration schema (credentials, settings) */
  config?: {
    type: "object";
    properties: Record<string, JSONSchemaType>;
    required?: string[];
  };
}

/**
 * Plugin execution options.
 */
export interface PluginExecutionOptions {
  /** Override timeout from manifest */
  timeout?: number;
  /** Override memory limit from manifest */
  memoryLimit?: number;
  /** User configuration values */
  config?: Record<string, unknown>;
}

/**
 * Plugin execution result.
 */
export interface PluginExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Output data if successful */
  output?: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Memory used in bytes */
  memoryUsed?: number;
}

/**
 * Loaded plugin instance.
 */
export interface LoadedPlugin {
  /** Plugin ID from database */
  id: string;
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Call a function on this plugin */
  call: (
    functionName: string,
    input: unknown,
    options?: PluginExecutionOptions,
  ) => Promise<PluginExecutionResult>;
  /** Unload the plugin from memory */
  unload: () => Promise<void>;
}

/**
 * Plugin registry entry.
 */
export interface PluginRegistryEntry {
  /** Plugin ID */
  id: string;
  /** Workspace ID */
  workspaceId: string;
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin manifest */
  manifest: PluginManifest;
  /** WASM binary URL */
  wasmUrl: string;
  /** SHA256 hash of WASM binary */
  wasmHash: string;
  /** Whether plugin is enabled */
  isEnabled: boolean;
  /** Whether plugin is verified by platform */
  isVerified: boolean;
  /** User configuration */
  config: Record<string, unknown>;
}

/**
 * Plugin host interface.
 */
export interface PluginHost {
  /** Load a plugin by ID */
  loadPlugin: (pluginId: string) => Promise<LoadedPlugin>;
  /** Call a function on a plugin */
  callFunction: (
    pluginId: string,
    functionName: string,
    input: unknown,
    options?: PluginExecutionOptions,
  ) => Promise<PluginExecutionResult>;
  /** Unload a plugin from memory */
  unloadPlugin: (pluginId: string) => Promise<void>;
  /** Clear all loaded plugins */
  clearAll: () => Promise<void>;
}
