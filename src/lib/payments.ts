import Stripe from "stripe";

import { STRIPE_API_KEY } from "lib/config/env.config";

/**
 * Stripe payments client.
 * Only initialized if STRIPE_API_KEY is provided.
 */
const payments = STRIPE_API_KEY ? new Stripe(STRIPE_API_KEY) : null;

export default payments;
