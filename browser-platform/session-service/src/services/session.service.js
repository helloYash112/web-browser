const crypto = require("crypto");
const docker = require("./docker.service");

const {
  redis,
} = require("../config/redis");

async function createSession() {
  const sessionId = crypto.randomUUID();

  const containerName = `firefox-${sessionId}`;

  const container = await docker.createContainer({
    Image: "kasmweb/firefox:1.17.0",

    name: containerName,

    Env: [
      "DISABLE_AUTH=true",
      "VNC_RESOLUTION=1280x720",
      "MAX_FRAME_RATE=30"
    ],

    ExposedPorts: {
      "6901/tcp": {}
    },

    HostConfig: {
      ShmSize: 2147483648,

      PortBindings: {
        "6901/tcp": [
          {
            HostPort: ""
          }
        ]
      },

      RestartPolicy: {
        Name: "unless-stopped"
      }
    }
  });

  await container.start();

  const inspect = await container.inspect();

  const hostPort =
    inspect.NetworkSettings.Ports["6901/tcp"][0].HostPort;

  const browserUrl = `http://localhost:${hostPort}`;

  const session = {
    sessionId,
    containerId: container.id,
    containerName,
    hostPort,
    browserUrl,
    status: "running",
    createdAt: new Date().toISOString()
  };

  await redis.set(
    `session:${sessionId}`,
    JSON.stringify(session)
  );

  return session;
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

  return data
    ? JSON.parse(data)
    : null;
}

async function deleteSession(id) {
  const data = await redis.get(`session:${id}`);

  if (!data) {
    return null;
  }

  const session = JSON.parse(data);

  const container =
    docker.getContainer(session.containerId);

  try {
    await container.stop();
  } catch (err) {
    console.log(
      `Container ${session.containerId} already stopped`
    );
  }

  try {
    await container.remove();
  } catch (err) {
    console.log(
      `Container ${session.containerId} already removed`
    );
  }

  await redis.del(`session:${id}`);

  return true;
}

module.exports = {
  createSession,
  getSession,
  getAllSessions,
  deleteSession
};
