import { describe, expect, it } from "bun:test";

import { GraphQLError } from "graphql";
import { maskError } from "graphql-yoga";
import { SafeError, isSafeError } from "postgraphile/grafast";

/**
 * Custom maskError function matching server.ts implementation.
 * Allows Grafast SafeError messages through while masking other errors.
 */
const customMaskError = (
  error: unknown,
  message: string,
  isDev?: boolean,
): Error => {
  if (
    error instanceof GraphQLError &&
    error.originalError &&
    isSafeError(error.originalError)
  ) {
    return error;
  }

  return maskError(error, message, isDev);
};

describe("error masking", () => {
  it("should pass through SafeError messages wrapped in GraphQLError", () => {
    const safeErr = new SafeError(
      "Plan limit reached: workflows (10/3). Upgrade your plan to continue.",
    );
    const gqlErr = new GraphQLError(safeErr.message, {
      originalError: safeErr,
    });

    const result = customMaskError(gqlErr, "Unexpected error.", false);

    expect(result).toBe(gqlErr);
    expect((result as GraphQLError).message).toBe(
      "Plan limit reached: workflows (10/3). Upgrade your plan to continue.",
    );
  });

  it("should mask non-SafeError errors", () => {
    const internalErr = new Error("database connection failed");
    const gqlErr = new GraphQLError(internalErr.message, {
      originalError: internalErr,
    });

    const result = customMaskError(gqlErr, "Unexpected error.", false);

    expect(result).not.toBe(gqlErr);
    expect((result as GraphQLError).message).toBe("Unexpected error.");
  });

  it("should pass through plain GraphQLErrors without originalError", () => {
    const gqlErr = new GraphQLError("some internal detail");

    const result = customMaskError(gqlErr, "Unexpected error.", false);

    // Yoga treats GraphQLErrors without originalError as "original" (intentional)
    expect((result as GraphQLError).message).toBe("some internal detail");
  });

  it("should pass through original GraphQLErrors (no originalError) in dev", () => {
    const gqlErr = new GraphQLError("some detail");

    const result = customMaskError(gqlErr, "Unexpected error.", true);

    // In dev mode, yoga's default maskError passes through original GraphQL errors
    expect((result as GraphQLError).message).toBe("some detail");
  });

  it("should correctly identify SafeError via isSafeError", () => {
    const safeErr = new SafeError("test message");
    expect(isSafeError(safeErr)).toBe(true);

    const normalErr = new Error("test message");
    expect(isSafeError(normalErr)).toBeFalsy();
  });
});
