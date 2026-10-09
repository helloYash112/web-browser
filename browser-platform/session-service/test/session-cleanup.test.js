
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const sessions = new Map();
const containers = new Map();

let failStop = false;
let failRemove = false;

const fakeRedis = {
  async get(key) {
    return sessions.get(key) ?? null;
  },

  async set(key, value) {
    sessions.set(key, value);
    return "OK";
  },

  async del(key) {
    return sessions.delete(key) ? 1 : 0;
  },

  async keys(pattern) {
    if (pattern !== "session:*") return [];
    return [...sessions.keys()];
  },
};

const fakeDocker = {
  getContainer(id) {
    const container = containers.get(id);

    return {
      async stop() {
        if (failStop) {
          const error = new Error("Simulated Docker stop failure");
          error.statusCode = 500;
          throw error;
        }

        if (!container) {
          const error = new Error("Container not found");
          error.statusCode = 404;
          throw error;
        }

        container.running = false;
      },

      async remove() {
        if (failRemove) {
          const error = new Error("Simulated Docker remove failure");
          error.statusCode = 500;
          throw error;
        }

        if (!container) {
          const error = new Error("Container not found");
          error.statusCode = 404;
          throw error;
        }

        containers.delete(id);
      },
    };
  },
};

// Resolve the production module paths.
const redisPath = require.resolve("../src/config/redis");
const dockerPath = require.resolve("../src/services/docker.service");
const servicePath = require.resolve("../src/services/session.service");

// Save the existing module cache entries.
const originalRedis = require.cache[redisPath];
const originalDocker = require.cache[dockerPath];
const originalService = require.cache[servicePath];

// Remove the production service from cache so it loads with our fakes.
delete require.cache[servicePath];

// Inject mocked dependencies before importing the service.
require.cache[redisPath] = {
  id: redisPath,
  filename: redisPath,
  loaded: true,
  exports: { redis: fakeRedis },
};

require.cache[dockerPath] = {
  id: dockerPath,
  filename: dockerPath,
  loaded: true,
  exports: fakeDocker,
};

let deleteSession;

try {
  ({ deleteSession } = require("../src/services/session.service"));
} finally {
  // Restore the original dependency cache entries.
  if (originalRedis) {
    require.cache[redisPath] = originalRedis;
  } else {
    delete require.cache[redisPath];
  }

  if (originalDocker) {
    require.cache[dockerPath] = originalDocker;
  } else {
    delete require.cache[dockerPath];
  }

  // Keep the service instance loaded with our fake dependencies.
  // This test file uses that instance for all tests.
  if (originalService) {
    // Do not restore it: it may reference real dependencies.
    delete require.cache[servicePath];
  }
}

function seedSession(id) {
  const containerId = `container-${id}`;

  sessions.set(
    `session:${id}`,
    JSON.stringify({
      sessionId: id,
      containerId,
      containerName: `firefox-${id}`,
      createdAt: new Date().toISOString(),
    }),
  );

  containers.set(containerId, {
    id: containerId,
    running: true,
  });

  return { id, containerId };
}

test.beforeEach(() => {
  sessions.clear();
  containers.clear();
  failStop = false;
  failRemove = false;
});

test("failed Docker stop preserves the Redis record", async () => {
  const { id, containerId } = seedSession("stop-failure");
  failStop = true;

  await assert.rejects(
    deleteSession(id),
    /Simulated Docker stop failure/,
  );

  assert.ok(sessions.has(`session:${id}`));
  assert.ok(containers.has(containerId));
});

test("failed Docker removal preserves the Redis record", async () => {
  const { id, containerId } = seedSession("remove-failure");
  failRemove = true;

  await assert.rejects(
    deleteSession(id),
    /Simulated Docker remove failure/,
  );

  assert.ok(sessions.has(`session:${id}`));
  assert.ok(containers.has(containerId));
});

test("a later retry removes the container and Redis record", async () => {
  const { id, containerId } = seedSession("retry");

  failRemove = true;

  await assert.rejects(
    deleteSession(id),
    /Simulated Docker remove failure/,
  );

  assert.ok(sessions.has(`session:${id}`));

  // Simulate Docker recovering.
  failRemove = false;

  const result = await deleteSession(id);

  assert.equal(result, true);
  assert.equal(sessions.has(`session:${id}`), false);
  assert.equal(containers.has(containerId), false);
});

test("a missing Docker container does not block Redis cleanup", async () => {
  const { id, containerId } = seedSession("missing-container");

  containers.delete(containerId);

  const result = await deleteSession(id);

  assert.equal(result, true);
  assert.equal(sessions.has(`session:${id}`), false);
});

test("deleting a session absent from Redis is harmless", async () => {
  const result = await deleteSession("not-in-redis");

  assert.equal(result, null);
});