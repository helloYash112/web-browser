const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { redis } = require("../config/redis");

const {
  createSession,
  getSession,
  getAllSessions,
  deleteSession,
  syncSessionStatus,
} = require("../services/session.service");

const {
  auditReconciliation,
} = require("../services/reconciliation.service");

const {
  requireAuth,
  requireAdmin,
} = require("../middleware/auth.middleware");

// Health is public; all other session endpoints require authentication.
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "session-service",
  });
});

router.use(requireAuth);

router.post("/session", async (req, res, next) => {
  try {
    const session = await createSession(req.user.userId);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

router.post("/session/:id/browser-ticket", async (req, res, next) => {
  try {
    const sessionId = req.params.id;

    // Only the owner can launch this browser.
    const session = await getSession(sessionId, req.user.userId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const ticket = crypto.randomBytes(32).toString("hex");

    await redis.set(
      `browser-ticket:${ticket}`,
      JSON.stringify({
        sessionId,
        ownerId: req.user.userId,
      }),
      { EX: 60, NX: true }
    );

    res.status(201).json({
      sessionId,
      browserUrl: `http://${sessionId}.localhost:8080/?ticket=${ticket}`,
      expiresInSeconds: 60,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/sessions", async (req, res, next) => {
  try {
    const sessions = await getAllSessions(req.user.userId);

    res.status(200).json({
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/session/:id", async (req, res, next) => {
  try {
    const session = await getSession(
      req.params.id,
      req.user.userId
    );

    // Return the same response for missing and foreign sessions.
    if (!session) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    const updated = await syncSessionStatus(session);

    if (!updated) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/session/:id", async (req, res, next) => {
  try {
    const deleted = await deleteSession(
      req.params.id,
      req.user.userId
    );

    if (!deleted) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    res.status(200).json({
      sessionId: req.params.id,
      deleted: true,
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/reconciliation/audit",
  requireAdmin,
  async (req, res, next) => {
    try {
      const report = await auditReconciliation();
      res.status(200).json(report);
    } catch (error) {
      next(error);
    }
  }
);

router.use((error, req, res, next) => {
  console.error("Session API error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Internal session service error",
  });
});

module.exports = router;