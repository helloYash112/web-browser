const express = require("express");

const sessionRoutes =
  require("./routes/session.routes");

const app = express();

app.use(express.json());

app.use(sessionRoutes);

module.exports = app;