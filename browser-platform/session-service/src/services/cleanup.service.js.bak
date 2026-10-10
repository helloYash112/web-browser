
const {
  getAllSessions,
  deleteSession,
  syncAllSessionStatuses,
} = require("./session.service");

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
    // Synchronize saved statuses with actual Docker state.
    await syncAllSessionStatuses();

    // Then expire sessions based on creation time.
    const sessions = await getAllSessions();
    const now = Date.now();

    for (const session of sessions) {
      const createdAt = Date.parse(session.createdAt);

      if (!Number.isFinite(createdAt)) {
        console.warn(
          `Invalid creation time: ${session.sessionId}`
        );
        continue;
      }

      if (now - createdAt >= SESSION_TTL_MS) {
        console.log(
          `Cleaning up expired session: ${session.sessionId}`
        );

        try {
          await deleteSession(session.sessionId);
          console.log(
            `Removed expired session: ${session.sessionId}`
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
    `Background monitor started. TTL: ${SESSION_TTL_MS}ms; interval: ${CLEANUP_INTERVAL_MS}ms`
  );

  // Run once immediately, then repeat on the configured interval.
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