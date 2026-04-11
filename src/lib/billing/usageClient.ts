/**
 * Aether usage metering client.
 *
 * Records workflow run usage events to the Aether billing service.
 * Designed for fire-and-forget usage -- all errors are swallowed and
 * logged so metering never blocks request handling.
 */

import {
  BILLING_BASE_URL,
  BILLING_SERVICE_API_KEY,
} from "lib/config/env.config";
import logger from "lib/logger";

const APP_ID = "vortex";
const REQUEST_TIMEOUT_MS = 5_000;

type UsageRecordResponse = {
  id: string;
  meterKey: string;
  delta: number;
  recordedAt: string;
};

type UsageCheckResponse = {
  allowed: boolean;
  currentUsage: number;
  limit: number;
};

type UsageSummaryResponse = {
  meters: Record<string, { current: number; limit: number }>;
};

/**
 * Make an authenticated request to the Aether billing API.
 * Returns null on any error for graceful degradation.
 */
async function aetherFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T | null> {
  if (!BILLING_BASE_URL || !BILLING_SERVICE_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${BILLING_BASE_URL}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        "x-service-api-key": BILLING_SERVICE_API_KEY,
        ...options?.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn("Aether usage API returned non-OK status", {
        path,
        status: response.status,
      });
      return null;
    }

    return (await response.json()) as T;
  } catch (err) {
    logger.warn("Failed to reach Aether usage API", {
      path,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Record a usage event to Aether.
 * @param entityType - Billing entity type (e.g. "organization")
 * @param entityId - ID of the billing entity
 * @param meterKey - Usage meter identifier (e.g. "workflow_executions", "rejected_executions")
 * @param delta - Amount to increment
 * @param idempotencyKey - Optional key to prevent duplicate recording
 */
export async function recordUsage(
  entityType: string,
  entityId: string,
  meterKey: string,
  delta: number,
  idempotencyKey?: string,
): Promise<UsageRecordResponse | null> {
  return aetherFetch<UsageRecordResponse>(
    `/usage/${APP_ID}/${entityType}/${entityId}/${meterKey}/record`,
    {
      method: "POST",
      body: JSON.stringify({
        delta,
        ...(idempotencyKey && { idempotencyKey }),
      }),
    },
  );
}

/**
 * Check whether additional usage is allowed under the current plan.
 * @param entityType - Billing entity type (e.g. "organization")
 * @param entityId - ID of the billing entity
 * @param meterKey - Usage meter identifier
 * @param additionalUsage - How many units to check against the limit
 */
/** @knipignore Consumed by vortex-worker for pre-execution limit checks */
export async function checkUsage(
  entityType: string,
  entityId: string,
  meterKey: string,
  additionalUsage?: number,
): Promise<UsageCheckResponse | null> {
  const params = new URLSearchParams();
  if (additionalUsage !== undefined) {
    params.set("additionalUsage", String(additionalUsage));
  }

  const qs = params.toString();
  const path = `/usage/${APP_ID}/${entityType}/${entityId}/${meterKey}/check${qs ? `?${qs}` : ""}`;

  return aetherFetch<UsageCheckResponse>(path);
}

/**
 * Get a summary of all usage meters for an entity.
 * @param entityType - Billing entity type (e.g. "organization")
 * @param entityId - ID of the billing entity
 */
export async function getUsageSummary(
  entityType: string,
  entityId: string,
): Promise<UsageSummaryResponse | null> {
  return aetherFetch<UsageSummaryResponse>(
    `/usage/${APP_ID}/${entityType}/${entityId}/summary`,
  );
}
