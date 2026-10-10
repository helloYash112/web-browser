const express = require("express");

const authRoutes = require("./routes/auth.routes");
const sessionRoutes = require("./routes/session.routes");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.use("/auth", authRoutes);
app.use(sessionRoutes);

module.exports = app;