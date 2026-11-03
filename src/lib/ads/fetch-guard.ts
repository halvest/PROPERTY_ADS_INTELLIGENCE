/**
 * Guards concurrent data fetches so a slow response for a previous
 * context (e.g. the previously selected ad account) can never overwrite
 * state belonging to the latest context.
 */
export class FetchGuard {
  private sequence = 0;
  private controller: AbortController | null = null;

  /** Start a new request, aborting and invalidating any in-flight one. */
  begin(): { seq: number; signal: AbortSignal } {
    this.controller?.abort();
    this.controller = new AbortController();
    this.sequence += 1;
    return { seq: this.sequence, signal: this.controller.signal };
  }

  isCurrent(seq: number): boolean {
    return seq === this.sequence;
  }

  cancel(): void {
    this.controller?.abort();
    this.sequence += 1;
  }
}
