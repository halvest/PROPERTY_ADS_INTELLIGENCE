/**
 * Holds one idempotency key per analysis context.
 *
 * Retrying the SAME analysis context (same ad/scope/period/account after a
 * failure) reuses the same key, so the server can deduplicate the retry
 * instead of consuming quota twice. A successful completion clears the key,
 * so the next deliberate analysis is a new context execution with a new key.
 */
export class IdempotencyKeyManager {
  private context: string | null = null;
  private key: string | null = null;

  keyFor(context: string): string {
    if (this.context !== context || !this.key) {
      this.context = context;
      this.key = crypto.randomUUID();
    }
    return this.key;
  }

  /** Call after a successful analysis: the next run must use a fresh key. */
  complete(context: string): void {
    if (this.context === context) {
      this.context = null;
      this.key = null;
    }
  }
}
