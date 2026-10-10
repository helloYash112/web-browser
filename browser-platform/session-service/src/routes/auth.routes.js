const express = require("express");
const router = express.Router();

const {
  registerUser,
  authenticateUser,
  createAccessToken,
} = require("../services/auth.service");

function validateCredentials(username, password) {
  if (typeof username !== "string" ||
      typeof password !== "string") {
    return "Username and password are required";
  }

  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username.trim())) {
    return "Username must be 3-32 characters using letters, numbers, dots, underscores or hyphens";
  }

  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    return "Password must be at least 12 characters and no more than 72 UTF-8 bytes";
  }

  return null;
}

function sendAuthResponse(res, user, status = 200) {
  const accessToken = createAccessToken(user);

  return res.status(status).json({
    user: {
      id: user.id,
      username: user.username,
    },
    accessToken,
    tokenType: "Bearer",
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
}

router.post("/register", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const validationError = validateCredentials(username, password);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const user = await registerUser(username, password);
    return sendAuthResponse(res, user, 201);
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }

    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (typeof username !== "string" ||
        typeof password !== "string" ||
        username.trim().length === 0 ||
        password.length === 0) {
      return res.status(400).json({
        error: "Username and password are required",
      });
    }

    const user = await authenticateUser(username, password);

    if (!user) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    return sendAuthResponse(res, user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;