/**
 * Server credential for ingest mutations.
 *
 * This repository's own Next.js server (`/api/forecast`, `/api/historical`,
 * `scripts/import_historical_dataset.mjs`) calls Convex without a Firebase
 * identity — Convex cannot reach the developer's loopback machine, so the
 * write direction is always local → cloud. Those calls prove they belong to
 * the project by presenting the deployment's `RIVERGUARD_INGEST_SECRET`.
 *
 * Fail closed: when the variable is not set on the deployment, a request
 * carrying no user identity is rejected. Set the variable on the deployment
 * and in the web app's server environment (never `NEXT_PUBLIC_*`) to keep the
 * live write path working.
 */

/**
 * Convex exposes the deployment's environment variables on `process.env`, but
 * `convex/` is compiled without `@types/node` (the runtime is V8, not Node), so
 * the accessor is declared here rather than pulling Node's whole type surface
 * into functions that cannot use it.
 */
import { requireRole } from "./auth";

declare const process: { env: Record<string, string | undefined> };

/** Constant-time comparison, so the secret cannot be guessed a byte at a time. */
function sameSecret(candidate: string, expected: string): boolean {
  if (candidate.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    mismatch |= candidate.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

/**
 * Whether `secret` is this deployment's server credential.
 *
 * The same variable authorises the historical ingest and the server-side
 * forecast write: one credential to configure, one place to rotate it.
 */
export function hasIngestSecret(secret?: string | null): boolean {
  const expected = process.env.RIVERGUARD_INGEST_SECRET;
  return (
    typeof expected === "string" &&
    expected.length > 0 &&
    typeof secret === "string" &&
    sameSecret(secret, expected)
  );
}

/**
 * Authorise a global ingest call: either the deployment's server credential,
 * or a signed-in administrator. Historical imports are deployment-wide, so an
 * LGU assignment is the wrong boundary here — secret or admin, nothing else.
 */
export async function assertIngestAuthorized(
  ctx: any,
  secret?: string | null,
): Promise<void> {
  if (hasIngestSecret(secret)) {
    return;
  }

  await requireRole(ctx, ["admin"]);
}
