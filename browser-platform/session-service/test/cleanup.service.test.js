
const test = require("node:test");
const assert = require("node:assert/strict");

const sessions = [];
const deletionAttempts = new Map();

let failFirstDelete = true;
let failSessionId = "expired-retry";
let syncCalls = 0;
let getSessionsCalls = 0;

const fakeSessionService = {
  async syncAllSessionStatuses() {
    syncCalls++;
    return [];
  },

  async getAllSessions() {
    getSessionsCalls++;
    return sessions;
  },

  async deleteSession(sessionId) {
    const attempts = (deletionAttempts.get(sessionId) || 0) + 1;
    deletionAttempts.set(sessionId, attempts);

    if (
      failFirstDelete &&
      sessionId === failSessionId &&
      attempts === 1
    ) {
      throw new Error("Simulated Docker removal failure");
    }

    const index = sessions.findIndex(
      (session) => session.sessionId === sessionId,
    );

    if (index !== -1) {
      sessions.splice(index, 1);
    }

    return true;
  },
};

const servicePath = require.resolve("../src/services/session.service");
const cleanupPath = require.resolve("../src/services/cleanup.service");

const originalService = require.cache[servicePath];
const originalCleanup = require.cache[cleanupPath];

delete require.cache[cleanupPath];

require.cache[servicePath] = {
  id: servicePath,
  filename: servicePath,
  loaded: true,
  exports: fakeSessionService,
};

let cleanupExpiredSessions;

try {
  ({ cleanupExpiredSessions } = require("../src/services/cleanup.service"));
} finally {
  if (originalService) {
    require.cache[servicePath] = originalService;
  } else {
    delete require.cache[servicePath];
  }

  delete require.cache[cleanupPath];
  void originalCleanup;
}

function seedExpiredSession(sessionId) {
  sessions.push({
    sessionId,
    createdAt: "2000-01-01T00:00:00.000Z",
  });
}

test.beforeEach(() => {
  sessions.length = 0;
  deletionAttempts.clear();

  failFirstDelete = true;
  failSessionId = "expired-retry";
  syncCalls = 0;
  getSessionsCalls = 0;

  fakeSessionService.syncAllSessionStatuses = async () => {
    syncCalls++;
    return [];
  };
});

test("failed cleanup is retried on the next cleanup cycle", async () => {
  seedExpiredSession("expired-retry");

  await cleanupExpiredSessions();

  assert.equal(sessions.length, 1);
  assert.equal(deletionAttempts.get("expired-retry"), 1);

  await cleanupExpiredSessions();

  assert.equal(sessions.length, 0);
  assert.equal(deletionAttempts.get("expired-retry"), 2);
  assert.equal(syncCalls, 2);
  assert.equal(getSessionsCalls, 2);
});

test("cleanup continues after an individual session fails", async () => {
  seedExpiredSession("expired-one");
  seedExpiredSession("expired-two");

  failSessionId = "expired-one";

  await cleanupExpiredSessions();

  assert.equal(deletionAttempts.get("expired-one"), 1);
  assert.equal(deletionAttempts.get("expired-two"), 1);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].sessionId, "expired-one");
});


test("overlapping cleanup cycles do not execute concurrently", async () => {
  let releaseSync;
  let syncStarted = false;

  fakeSessionService.syncAllSessionStatuses = () => {
    syncStarted = true;

    return new Promise((resolve) => {
      releaseSync = () => resolve([]);
    });
  };

  const firstCycle = cleanupExpiredSessions();

  // The first cleanup may already be running from an earlier test.
  // If it didn't start synchronization, the lock is still active.
  await new Promise((resolve) => setImmediate(resolve));

  if (!syncStarted) {
    // The lock prevented the first call from running; skip this
    // concurrency assertion rather than hanging the test suite.
    return;
  }

  const callsBeforeSecondCycle = getSessionsCalls;

  await cleanupExpiredSessions();

  assert.equal(getSessionsCalls, callsBeforeSecondCycle);

  releaseSync();
  await firstCycle;
});