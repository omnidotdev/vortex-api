/**
 * Iggy-backed event streaming client.
 *
 * Wraps `apache-iggy` to provide a Vortex-specific API for publishing
 * structured events to the Iggy streaming server. Each organization
 * gets its own topic for tenant isolation; a shared "system" topic
 * handles platform-level events.
 */

import { randomUUID } from "node:crypto";

import { Client, Partitioning } from "apache-iggy";
import { CompressionAlgorithm } from "apache-iggy/dist/wire/topic/topic.utils.js";

import { dbPool } from "lib/db/db";
import { eventLogTable } from "lib/db/schema";
import logger from "lib/logger";
import { RETENTION_MICROSECONDS } from "./retention";

import type { EventsConfig, OmniEvent } from "./types";

const STREAM_NAME = "omni-events";
// Reference the stream by name: apache-iggy server-assigns numeric ids, so the
// requested numeric id is not honored; the name is the stable identifier
const STREAM_ID = STREAM_NAME;
const SYSTEM_TOPIC = "system";
const DEFAULT_PARTITIONS = 3;

/**
 * Partial event input, omitting fields the client generates automatically.
 */
type EventInput = Omit<OmniEvent, "id" | "timestamp">;

/**
 * Client for publishing events to the Iggy streaming server.
 */
class EventsClient {
  #config: EventsConfig;
  #client: Client | null = null;
  #knownTopics = new Set<string>();

  constructor(config: EventsConfig) {
    this.#config = config;
  }

  /**
   * Connect to Iggy and ensure the base stream and system topic exist.
   */
  async initialize(): Promise<void> {
    this.#client = new Client({
      transport: "TCP",
      options: { host: this.#config.host, port: this.#config.port },
      credentials: {
        username: this.#config.username,
        password: this.#config.password,
      },
    });

    await this.#ensureStream();
    await this.#ensureTopic(SYSTEM_TOPIC);

    logger.info("Events client initialized", {
      host: this.#config.host,
      port: this.#config.port,
    });
  }

  /**
   * Publish an event to the organization's topic.
   *
   * Automatically generates `id` and `timestamp`, ensures the org topic
   * exists, and partitions by `subject` when provided.
   */
  async publish(input: EventInput): Promise<OmniEvent> {
    const event = this.#buildEvent(input);
    const topicName = input.organizationId;

    await this.#ensureTopic(topicName);

    const partition = event.subject
      ? Partitioning.MessageKey(event.subject)
      : Partitioning.Balanced;

    await this.#requireClient().message.send({
      streamId: STREAM_ID,
      topicId: topicName,
      messages: [{ payload: Buffer.from(JSON.stringify(event)) }],
      partition,
    });

    logger.debug("Event published", {
      eventId: event.id,
      type: event.type,
      topic: topicName,
    });

    // Best-effort: log to event_log for replay (never blocks publish)
    dbPool
      .insert(eventLogTable)
      .values({
        specversion: event.specversion,
        type: event.type,
        source: event.source,
        subject: event.subject,
        organizationId: event.organizationId,
        data: event.data,
        correlationId: event.correlationId,
        schemaId: event.schemaId,
        dataschema: event.dataschema,
        timestamp: event.timestamp,
      })
      .catch((err) => {
        logger.warn("Failed to write to event_log", {
          eventId: event.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return event;
  }

  /**
   * Publish an event to the shared system topic.
   */
  async publishSystem(input: EventInput): Promise<OmniEvent> {
    const event = this.#buildEvent(input);

    const partition = event.subject
      ? Partitioning.MessageKey(event.subject)
      : Partitioning.Balanced;

    await this.#requireClient().message.send({
      streamId: STREAM_ID,
      topicId: SYSTEM_TOPIC,
      messages: [{ payload: Buffer.from(JSON.stringify(event)) }],
      partition,
    });

    logger.debug("System event published", {
      eventId: event.id,
      type: event.type,
    });

    return event;
  }

  /**
   * Close the underlying Iggy connection.
   */
  close(): void {
    this.#client?.destroy();
    this.#client = null;
    this.#knownTopics.clear();

    logger.info("Events client closed");
  }

  // -- Private helpers --

  #requireClient(): Client {
    if (!this.#client) {
      throw new Error("EventsClient not initialized, call initialize() first");
    }

    return this.#client;
  }

  #buildEvent(input: EventInput): OmniEvent {
    return {
      ...input,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Idempotently ensure the omni-events stream exists.
   */
  async #ensureStream(): Promise<void> {
    const client = this.#requireClient();

    try {
      await client.stream.get({ streamId: STREAM_ID });
    } catch {
      // streamId is server-assigned (the SDK does not serialize a requested id)
      await client.stream.create({ name: STREAM_NAME });
      logger.info("Created stream", { name: STREAM_NAME });
    }
  }

  /**
   * Idempotently ensure a topic exists within the omni-events stream.
   */
  async #ensureTopic(name: string): Promise<void> {
    if (this.#knownTopics.has(name)) return;

    const client = this.#requireClient();

    try {
      await client.topic.get({ streamId: STREAM_ID, topicId: name });
    } catch {
      await client.topic.create({
        streamId: STREAM_ID,
        name,
        partitionCount: DEFAULT_PARTITIONS,
        compressionAlgorithm: CompressionAlgorithm.None,
        messageExpiry: RETENTION_MICROSECONDS,
      });
      logger.info("Created topic", { streamId: STREAM_ID, topic: name });
    }

    this.#knownTopics.add(name);
  }
}

export default EventsClient;
