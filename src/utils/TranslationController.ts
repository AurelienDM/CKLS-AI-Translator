/**
 * Translation Controller
 * Manages pause/resume/cancel functionality for translation operations
 */

export class TranslationController {
  private abortController: AbortController;
  private _paused: boolean = false;
  private _cancelled: boolean = false;
  private pauseResolvers: Array<() => void> = [];

  constructor() {
    this.abortController = new AbortController();
  }

  /**
   * Pause the translation process
   */
  pause(): void {
    this._paused = true;
  }

  /**
   * Resume the translation process
   */
  resume(): void {
    this._paused = false;
    // Resolve all pending pause promises
    this.pauseResolvers.forEach(resolve => resolve());
    this.pauseResolvers = [];
  }

  /**
   * Cancel the translation process
   */
  cancel(): void {
    this._cancelled = true;
    this._paused = false;
    this.abortController.abort();
    // Resolve all pending pause promises to allow cleanup
    this.pauseResolvers.forEach(resolve => resolve());
    this.pauseResolvers = [];
  }

  /**
   * Wait while paused (async)
   * Returns immediately if not paused or cancelled
   */
  async waitIfPaused(): Promise<void> {
    if (this._cancelled) {
      return Promise.resolve();
    }
    
    if (!this._paused) {
      return Promise.resolve();
    }

    // Create a promise that resolves when resume() is called
    return new Promise<void>((resolve) => {
      this.pauseResolvers.push(resolve);
    });
  }

  /**
   * Check if translation is cancelled
   */
  get cancelled(): boolean {
    return this._cancelled;
  }

  /**
   * Check if translation is paused
   */
  get paused(): boolean {
    return this._paused;
  }

  /**
   * Get the AbortSignal for fetch cancellation
   */
  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Reset the controller for reuse
   */
  reset(): void {
    this.abortController = new AbortController();
    this._paused = false;
    this._cancelled = false;
    this.pauseResolvers = [];
  }
}

