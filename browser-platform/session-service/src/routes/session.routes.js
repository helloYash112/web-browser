const express = require("express");

const router = express.Router();

const {
  createSession,
  getSession,
  getAllSessions,
  deleteSession
} = require("../services/session.service");

router.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

router.post("/session", async (req, res) => {

  const session =
    await createSession();

  res.json(session);

});

router.get("/sessions", (req, res) => {
  const sessions = sessionService.getAllSessions();

  res.json({
    count: sessions.length,
    sessions
  });
});
router.get("/session/:id", (req, res) => {

  const session =
    getSession(req.params.id);

  if (!session) {
    return res.status(404).send();
  }

  res.json(session);

});

router.delete("/session/:id", async (req, res) => {

  const deleted =
    await deleteSession(req.params.id);

  if (!deleted) {
    return res.status(404).send();
  }

  res.json({
    deleted: true
  });

});

module.exports = router;