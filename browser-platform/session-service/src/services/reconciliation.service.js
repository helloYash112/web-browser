const docker = require("./docker.service");
const { getAllSessions } = require("./session.service");

async function auditReconciliation() {
// Read session records from Redis.
const sessions = await getAllSessions();

// Discover all Docker containers, including stopped containers.
const containers = await docker.listContainers({
all: true,
filters: {
name: ["firefox-"],
},
});

// Keep only containers managed by this platform's naming convention.

const managedContainers = containers.filter((container) =>
  container.Names.some((name) =>
    /^\/firefox-[0-9a-f-]{36}$/i.test(name)
  )
);
const sessionsById = new Map(
sessions.map((session) => [session.sessionId, session]),
);

const containersBySessionId = new Map();

for (const container of managedContainers) {
for (const name of container.Names) {

const match = name.match(
  /^\/firefox-([0-9a-f-]{36})$/i
);

  if (match) {
    containersBySessionId.set(match[1], container);
  }
}


}

const missingContainers = [];
const stoppedContainers = [];
const mismatches = [];
const orphanContainers = [];

// Compare every Redis session with its Docker container.
for (const session of sessions) {
const container = containersBySessionId.get(
session.sessionId,
);


if (!container) {
  missingContainers.push({
    sessionId: session.sessionId,
    containerId: session.containerId,
    containerName: session.containerName,
  });

  continue;
}

if (container.Id !== session.containerId) {
  mismatches.push({
    sessionId: session.sessionId,
    expectedContainerId: session.containerId,
    actualContainerId: container.Id,
  });
}

if (container.State !== "running") {
  stoppedContainers.push({
    sessionId: session.sessionId,
    containerName: session.containerName,
    state: container.State,
    status: container.Status,
  });
}


}

// Find managed Docker containers without Redis sessions.
for (const [sessionId, container] of containersBySessionId) {
if (!sessionsById.has(sessionId)) {
orphanContainers.push({
sessionId,
containerId: container.Id,

containerName: container.Names[0]?.replace(/^\//, ""),
state: container.State,
status: container.Status,
});
}
}

return {
auditMode: "read-only",
auditedAt: new Date().toISOString(),
summary: {
redisSessions: sessions.length,
managedDockerContainers: managedContainers.length,
missingContainers: missingContainers.length,
stoppedContainers: stoppedContainers.length,
mismatches: mismatches.length,
orphanContainers: orphanContainers.length,
},
findings: {
missingContainers,
stoppedContainers,
mismatches,
orphanContainers,
},
};
}

module.exports = { auditReconciliation };

