import * as Sentry from "@sentry/bun";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  beforeSend(event) {
    // Strip sensitive headers
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }

    // Redact SQL patterns in exception values
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) {
          ex.value = ex.value.replace(
            /(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|VALUES)\b[^"']*/gi,
            "[SQL REDACTED]",
          );
        }
      }
    }

    return event;
  },
});

export default Sentry;
