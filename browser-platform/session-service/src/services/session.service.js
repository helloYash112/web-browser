const crypto = require("crypto");
const docker = require("./docker.service");
const { redis } = require("../config/redis");
const https = require("https");

async function createSession() {
  const sessionId = crypto.randomUUID();
  const containerName = `firefox-${sessionId}`;

  let container = null;

  try {
    // 1. Create the Firefox container.
    container = await docker.createContainer({
      Image: "kasmweb/firefox:1.17.0",
      name: containerName,

      Env: [
        "DISABLE_AUTH=true",
        "VNC_RESOLUTION=1280x720",
        "MAX_FRAME_RATE=30",
        "VNC_PW=vncpassword",
      ],

      ExposedPorts: {
        "6901/tcp": {},
      },

      HostConfig: {
        NetworkMode: "browser-platform-net",
        ShmSize: 2147483648,

        PortBindings: {
          "6901/tcp": [{ HostPort: "" }],
        },

        RestartPolicy: {
          Name: "unless-stopped",
        },
      },
    });

    // 2. Start the browser.
    await container.start();

    // 3. Confirm Docker assigned a host port.
    const inspect = await container.inspect();
    const portBindings = inspect.NetworkSettings.Ports["6901/tcp"];
    const hostPort = portBindings?.[0]?.HostPort;

    if (!hostPort) {
      throw new Error("Docker did not assign a browser port");
    }

    // 4. Build the session record.
    const session = {
      sessionId,
      containerId: container.id,
      containerName,
      hostPort,
      browserUrl: `http://localhost:${hostPort}`,
      status: "running",
      createdAt: new Date().toISOString(),
    };

    // 5. Save the session in Redis.
    await redis.set(`session:${sessionId}`, JSON.stringify(session));

    console.log(`Session created: ${sessionId}`);

    return session;
  } catch (error) {
    console.error(`Session creation failed (${sessionId}):`, error.message);

    // Remove any container created before the failure.
    if (container) {
      try {
        await container.remove({ force: true, v: true });

        console.log(`Cleaned up failed container: ${containerName}`);
      } catch (cleanupError) {
        console.error(
          `Failed to clean up ${containerName}:`,
          cleanupError.message,
        );
      }
    }

    throw error;
  }
}

async function getAllSessions() {
  const keys = await redis.keys("session:*");
  const sessions = [];

  for (const key of keys) {
    const data = await redis.get(key);

    if (data) {
      sessions.push(JSON.parse(data));
    }
  }

  return sessions;
}

async function getSession(id) {
  const data = await redis.get(`session:${id}`);
  return data ? JSON.parse(data) : null;
}

async function deleteSession(id) {
  const data = await redis.get(`session:${id}`);

  if (!data) {
    return null;
  }

  const session = JSON.parse(data);
  const container = docker.getContainer(session.containerId);

  try {
    await container.stop();
  } catch (error) {
    // It may already be stopped.
    if (error.statusCode !== 304 && error.statusCode !== 404) {
      throw error;
    }
  }

  // Remove the container before deleting the Redis record.
  try {
    await container.remove({ v: true });
  } catch (error) {
    if (error.statusCode !== 404) {
      throw error;
    }
  }

  await redis.del(`session:${id}`);

  console.log(`Session deleted: ${id}`);

  return true;
}

function checkBrowserHttp(containerName) {
  return new Promise((resolve) => {
    const request = https.get(
      `https://${containerName}:6901/`,
      {
        rejectUnauthorized: false,
        timeout: 5000,
      },
      (response) => {
        const result = {
          healthy: response.statusCode < 500,
          httpStatus: response.statusCode,
        };

        response.resume();
        resolve(result);
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("Health check timed out"));
    });

    request.on("error", (error) => {
      resolve({
        healthy: false,
        error: error.message,
      });
    });
  });
}

async function syncSessionStatus(session) {
  const key = `session:${session.sessionId}`;
  const data = await redis.get(key);

  if (!data) {
    return null;
  }

  const currentSession = JSON.parse(data);
  const container = docker.getContainer(currentSession.containerId);

  try {
    const inspect = await container.inspect();

    if (!inspect.State.Running) {
      currentSession.status =
        inspect.State.Status === "exited" ? "stopped" : inspect.State.Status;

      // Remove health data left over from a previous successful check.
      delete currentSession.httpHealth;
      delete currentSession.httpStatus;
      delete currentSession.healthError;
    } else {
      const health = await checkBrowserHttp(currentSession.containerName);

      currentSession.status = health.healthy ? "running" : "unhealthy";

      currentSession.httpHealth = health.healthy ? "reachable" : "unreachable";

      if (health.httpStatus !== undefined) {
        currentSession.httpStatus = health.httpStatus;
      }

      if (health.error) {
        currentSession.healthError = health.error;
      } else {
        delete currentSession.healthError;
      }
    }

    currentSession.lastCheckedAt = new Date().toISOString();

    await redis.set(key, JSON.stringify(currentSession));

    return currentSession;
  } catch (error) {
    if (error.statusCode === 404) {
      currentSession.status = "missing";
      currentSession.lastCheckedAt = new Date().toISOString();

      await redis.set(key, JSON.stringify(currentSession));

      return currentSession;
    }

    throw error;
  }
}

async function syncAllSessionStatuses() {
  const sessions = await getAllSessions();
  const results = [];

  for (const session of sessions) {
    try {
      const updated = await syncSessionStatus(session);

      if (updated) {
        results.push(updated);
      }
    } catch (error) {
      console.error(
        `Status check failed for ${session.sessionId}:`,
        error.message,
      );
    }
  }

  return results;
}

module.exports = {
  createSession,
  getAllSessions,
  getSession,
  deleteSession,
  syncSessionStatus,
  syncAllSessionStatuses,
};
