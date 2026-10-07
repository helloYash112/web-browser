const crypto = require("crypto");
const docker = require("./docker.service");
const sessions = require("../store/session.store");

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

  sessions.set(sessionId, session);

  return session;
}

function getAllSessions() {
  return [...sessions.values()];
}

function getSession(id) {
  return sessions.get(id);
}

async function deleteSession(id) {
  const session = sessions.get(id);

  if (!session) {
    return null;
  }

  const container =
    docker.getContainer(session.containerId);

  await container.stop();
  await container.remove();

  sessions.delete(id);

  return true;
}

module.exports = {
  createSession,
  getSession,
  getAllSessions,
  deleteSession
};