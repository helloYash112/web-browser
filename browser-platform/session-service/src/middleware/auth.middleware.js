const jwt = require("jsonwebtoken");
const { redis } = require("../config/redis");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters");
}

async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const token = authorization.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "browser-platform",
      audience: "browser-platform-api",
    });

    // Load the identity from Redis rather than trusting client input.
    const data = await redis.get(`user:id:${decoded.sub}`);

    if (!data) {
      return res.status(401).json({
        error: "User account not found",
      });
    }

    const user = JSON.parse(data);

    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError" ||
        error.name === "NotBeforeError") {
      return res.status(401).json({
        error: "Invalid or expired access token",
      });
    }

    next(error);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      error: "Administrator access required",
    });
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
};