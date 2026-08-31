/**
 * CloudEvents v1.0 envelope for all Omni platform events.
 *
 * Every event flowing through the streaming layer conforms to this shape,
 * providing consistent metadata for routing, tracing, and replay.
 *
 * @see https://cloudevents.io/
 */
export type OmniEvent = {
  /** CloudEvents spec version */
  specversion?: string;
  id: string;
  type: string;
  subject?: string;
  source: string;
  /** MIME type of `data` */
  datacontenttype?: string;
  /** URI to the event's JSON Schema definition in the registry */
  dataschema?: string;
  data: Record<string, unknown>;
  /** ISO 8601 timestamp */
  time?: string;
  /** @deprecated Use `time` instead (CloudEvents naming) */
  timestamp: string;
  organizationId: string;
  correlationId?: string;
  /**
   * Idempotency key identifying a single logical delivery, used for
   * deduplication in the worker. Unlike `correlationId` (shared across related
   * events for tracing) it is unique per delivery, so keying dedup on it does
   * not drop related events. Absent when the producer sets none.
   */
  idempotencyKey?: string;
  /** @deprecated Use `dataschema` instead */
  schemaId?: string;
  // -- Omni CloudEvents extension attributes --
  /** Organization ID (Omni extension) */
  omniorgid?: string;
  /** Workspace ID (Omni extension) */
  omniworkspaceid?: string;
  /** Event schema version (Omni extension) */
  omnischemaversion?: number;
};

/**
 * Configuration for connecting to the Iggy streaming server.
 */
export type EventsConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
};
