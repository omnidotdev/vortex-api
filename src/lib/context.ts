import { randomUUID } from "node:crypto";

/**
 * Generate a unique request ID for correlation.
 */
function generateRequestId(): string {
  return randomUUID();
}

export { generateRequestId };
