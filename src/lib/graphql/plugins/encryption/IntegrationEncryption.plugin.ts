import { createCipheriv, randomBytes } from "node:crypto";

import { EXPORTABLE } from "graphile-export";
import { context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import type { CipherGCMTypes } from "node:crypto";
import type { PlanWrapperFn } from "postgraphile/utils";

// Constants for AES-256-GCM encryption
const ALGORITHM: CipherGCMTypes = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt the config field before storing in the database.
 * This wraps the createIntegration and updateIntegration mutations.
 *
 * All crypto dependencies are passed through EXPORTABLE to satisfy graphile-export.
 */
const encryptConfigOnMutation = (propName: string) =>
  EXPORTABLE(
    (
      _context,
      sideEffect,
      createCipheriv,
      randomBytes,
      ALGORITHM,
      IV_LENGTH,
      AUTH_TAG_LENGTH,
      propName,
    ): PlanWrapperFn =>
      (plan, _$source, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]);

        sideEffect([$input], ([input]) => {
          /**
           * Encrypt a value using AES-256-GCM.
           * Inlined here to satisfy graphile-export requirements.
           */
          const encryptValue = (plaintext: string): string => {
            const key = process.env.ENCRYPTION_KEY;
            if (!key) {
              throw new Error(
                "ENCRYPTION_KEY environment variable is required",
              );
            }

            const keyBuffer = Buffer.from(key, "base64");
            if (keyBuffer.length !== 32) {
              throw new Error("ENCRYPTION_KEY must be 32 bytes when decoded");
            }

            const iv = randomBytes(IV_LENGTH);
            const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);

            const encrypted = Buffer.concat([
              cipher.update(plaintext, "utf8"),
              cipher.final(),
            ]);

            const authTag = cipher.getAuthTag();

            return [
              iv.toString("base64"),
              authTag.toString("base64"),
              encrypted.toString("base64"),
            ].join(":");
          };

          /**
           * Check if a string looks like our encrypted format.
           */
          const isEncrypted = (value: string): boolean => {
            const parts = value.split(":");
            if (parts.length !== 3) return false;
            try {
              const iv = Buffer.from(parts[0], "base64");
              const authTag = Buffer.from(parts[1], "base64");
              return (
                iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH
              );
            } catch {
              return false;
            }
          };

          // Encrypt config for create mutations
          if (input?.config && typeof input.config === "object") {
            const configStr = JSON.stringify(input.config);
            if (!isEncrypted(configStr)) {
              input.config = encryptValue(JSON.stringify(input.config));
            }
          }

          // Encrypt config for update mutations (patch object)
          if (input?.patch?.config && typeof input.patch.config === "object") {
            const configStr = JSON.stringify(input.patch.config);
            if (!isEncrypted(configStr)) {
              input.patch.config = encryptValue(
                JSON.stringify(input.patch.config),
              );
            }
          }
        });

        return plan();
      },
    [
      context,
      sideEffect,
      createCipheriv,
      randomBytes,
      ALGORITHM,
      IV_LENGTH,
      AUTH_TAG_LENGTH,
      propName,
    ],
  );

/**
 * Encryption plugin for integration config field.
 *
 * This plugin encrypts the `config` JSONB field before INSERT/UPDATE.
 * Decryption happens at the application layer when reading integrations.
 */
const IntegrationEncryptionPlugin = wrapPlans({
  Mutation: {
    createIntegration: encryptConfigOnMutation("integration"),
    updateIntegration: encryptConfigOnMutation("patch"),
  },
});

export default IntegrationEncryptionPlugin;
