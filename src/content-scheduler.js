(() => {
  "use strict";

  const RECONCILE_DELAY_MS = 160;
  const IDLE_RECONCILE_TIMEOUT_MS = 900;
  const URGENT_RECONCILE_DELAY_MS = 0;

  /**
   * Closed priorities for reconciliation requests.
   */
  const ReconcilePriority = Object.freeze({
    URGENT: "urgent",
    LAZY: "lazy"
  });

  /**
   * Coalesces reconciliation requests into urgent and lazy execution lanes.
   */
  class ReconcileScheduler {
    /**
     * Creates a scheduler that invokes one reconciliation callback.
     *
     * @param {(resetSourceRoute: boolean) => void} onRun
     */
    constructor(onRun) {
      this.onRun = onRun;
      this.pending = false;
      this.pendingResetSourceRoute = false;
      this.urgentTimer = null;
      this.delayTimer = null;
      this.idleHandle = null;
    }

    /**
     * Requests a reconciliation pass.
     *
     * @param {boolean} [resetSourceRoute]
     * @param {string} [priority]
     */
    request(resetSourceRoute = false, priority = ReconcilePriority.LAZY) {
      this.pending = true;
      this.pendingResetSourceRoute =
        this.pendingResetSourceRoute || resetSourceRoute;

      if (priority === ReconcilePriority.URGENT) {
        this.scheduleUrgent();
        return;
      }

      this.scheduleLazy();
    }

    /**
     * Clears all queued reconciliation work.
     */
    cancel() {
      this.clearUrgentTimer();
      this.clearDelayTimer();
      this.clearIdleCallback();
      this.pending = false;
      this.pendingResetSourceRoute = false;
    }

    /**
     * Schedules an urgent pass after the current browser task.
     */
    scheduleUrgent() {
      this.clearDelayTimer();
      this.clearIdleCallback();

      if (this.urgentTimer !== null) {
        return;
      }

      this.urgentTimer = window.setTimeout(() => {
        this.urgentTimer = null;
        this.run();
      }, URGENT_RECONCILE_DELAY_MS);
    }

    /**
     * Schedules a lazy pass through debounce and idle time.
     */
    scheduleLazy() {
      if (
        this.urgentTimer !== null ||
        this.delayTimer !== null ||
        this.idleHandle !== null
      ) {
        return;
      }

      this.delayTimer = window.setTimeout(() => {
        this.delayTimer = null;
        this.scheduleIdle();
      }, RECONCILE_DELAY_MS);
    }

    /**
     * Schedules the pending lazy pass during idle time or a bounded timeout.
     */
    scheduleIdle() {
      if (!this.pending) {
        return;
      }

      if (typeof window.requestIdleCallback === "function") {
        this.idleHandle = window.requestIdleCallback(
          () => {
            this.idleHandle = null;
            this.run();
          },
          { timeout: IDLE_RECONCILE_TIMEOUT_MS }
        );
        return;
      }

      this.delayTimer = window.setTimeout(() => {
        this.delayTimer = null;
        this.run();
      }, RECONCILE_DELAY_MS);
    }

    /**
     * Runs the pending reconciliation callback.
     */
    run() {
      this.clearUrgentTimer();
      this.clearDelayTimer();
      this.clearIdleCallback();

      if (!this.pending) {
        return;
      }

      const resetSourceRoute = this.pendingResetSourceRoute;
      this.pending = false;
      this.pendingResetSourceRoute = false;
      this.onRun(resetSourceRoute);
    }

    /**
     * Clears the urgent timer.
     */
    clearUrgentTimer() {
      if (this.urgentTimer === null) {
        return;
      }

      window.clearTimeout(this.urgentTimer);
      this.urgentTimer = null;
    }

    /**
     * Clears the lazy debounce timer.
     */
    clearDelayTimer() {
      if (this.delayTimer === null) {
        return;
      }

      window.clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }

    /**
     * Clears the idle callback.
     */
    clearIdleCallback() {
      if (this.idleHandle === null) {
        return;
      }

      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(this.idleHandle);
      }
      this.idleHandle = null;
    }
  }

  /**
   * Stable scheduling helpers loaded before the main content-script runtime.
   */
  window.__bibililiScheduler = Object.freeze({
    ReconcilePriority,
    ReconcileScheduler
  });
})();
