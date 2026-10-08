// pg@9 removes implicit queuing. Serialize work on each connection, preserving
// pool concurrency across connections and the adapter's transaction ordering.
exports.serialClient = (Client) =>
  class extends Client {
    query(...args) {
      const callback = typeof args.at(-1) === "function" ? args.pop() : null;
      const pending = (this.queryTail || Promise.resolve()).then(() =>
        super.query(...args),
      );
      this.queryTail = pending.catch(() => {});
      if (callback) {
        pending.then(
          (result) => callback(null, result),
          (error) => callback(error),
        );
        return;
      }
      return pending;
    }
  };
