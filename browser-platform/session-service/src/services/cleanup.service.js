
const {
  getAllSessions,
  deleteSession,
  syncAllSessionStatuses,
} = require("./session.service");
const { redis } = require("../config/redis");

const SESSION_TTL_MS = Number(
  process.env.SESSION_TTL_MS || 30 * 60 * 1000
);

const CLEANUP_INTERVAL_MS = Number(
  process.env.CLEANUP_INTERVAL_MS || 30 * 1000
);

let cleanupTimer = null;
let cleanupRunning = false;

async function cleanupExpiredSessions() {
  if (cleanupRunning) return;

  cleanupRunning = true;

  try {
    await syncAllSessionStatuses();

    const sessions = await getAllSessions();
    const now = Date.now();

    for (const session of sessions) {
      const activityKey = `session-activity:${session.sessionId}`;
      const activityValue = await redis.get(activityKey);

      const fallbackTime = Date.parse(
        session.lastActivityAt || session.createdAt
      );

      const lastActivity = activityValue
        ? Number(activityValue)
        : fallbackTime;

      if (!Number.isFinite(lastActivity)) {
        console.warn(
          `Invalid activity time: ${session.sessionId}`
        );
        continue;
      }

      if (now - lastActivity >= SESSION_TTL_MS) {
        console.log(
          `Cleaning up inactive session: ${session.sessionId}`
        );

        try {
          await deleteSession(session.sessionId);
          await redis.del(activityKey);

          console.log(
            `Removed inactive session: ${session.sessionId}`
          );
        } catch (error) {
          console.error(
            `Failed to remove ${session.sessionId}:`,
            error.message
          );
        }
      }
    }
  } catch (error) {
    console.error(
      "Background session monitor failed:",
      error.message
    );
  } finally {
    cleanupRunning = false;
  }
}

function startCleanupJob() {
  if (cleanupTimer) return;

  console.log(
    `Background monitor started. Inactivity TTL: ${SESSION_TTL_MS}ms; interval: ${CLEANUP_INTERVAL_MS}ms`
  );

  void cleanupExpiredSessions();

  cleanupTimer = setInterval(() => {
    void cleanupExpiredSessions();
  }, CLEANUP_INTERVAL_MS);
}

function stopCleanupJob() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

module.exports = {
  startCleanupJob,
  stopCleanupJob,
  cleanupExpiredSessions,
};
