/**
 * Active chat stream registry for server-side abort.
 */
const { randomUUID } = require('crypto');

class StreamRegistry {
  constructor() {
    /** @type {Map<string, { abort: () => void, res: any }>} */
    this.streams = new Map();
  }

  register(res, abortFn) {
    const id = randomUUID();
    this.streams.set(id, { res, abort: abortFn });
    res.on('close', () => this.streams.delete(id));
    return id;
  }

  abort(id) {
    const entry = this.streams.get(id);
    if (!entry) return false;
    try {
      entry.abort();
    } catch { /* ignore */ }
    this.streams.delete(id);
    return true;
  }

  abortAll() {
    for (const [id] of this.streams) this.abort(id);
  }
}

module.exports = { StreamRegistry };
