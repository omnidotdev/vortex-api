/**
 * Shared provider instances for Vortex.
 *
 * Instantiates billing provider from @omnidotdev/providers
 * with Vortex-specific configuration from environment variables.
 */

import { createBillingProvider } from "@omnidotdev/providers/billing";

import {
  BILLING_BASE_URL,
  BILLING_SERVICE_API_KEY,
} from "lib/config/env.config";

export const billing = createBillingProvider(
  BILLING_BASE_URL
    ? {
        provider: "aether",
        baseUrl: BILLING_BASE_URL,
        serviceApiKey: BILLING_SERVICE_API_KEY,
        appId: "vortex",
      }
    : {},
);
