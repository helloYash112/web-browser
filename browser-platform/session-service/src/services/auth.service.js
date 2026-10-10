const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { redis } = require("../config/redis");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters");
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";

function createAccessToken(user) {
  return jwt.sign(
    {
      username: user.username,
    },
    JWT_SECRET,
    {
      subject: user.id,
      expiresIn: JWT_EXPIRES_IN,
      issuer: "browser-platform",
      audience: "browser-platform-api",
      algorithm: "HS256",
    }
  );
}

async function registerUser(username, password) {
  const id = crypto.randomUUID();
  const normalizedUsername = username.trim().toLowerCase();

  const user = {
    id,
    username: normalizedUsername,
    passwordHash: await bcrypt.hash(password, 12),
    role: "user",
    createdAt: new Date().toISOString(),
  };

  const usernameKey = `user:username:${normalizedUsername}`;
  const userKey = `user:id:${id}`;

  // NX prevents two registrations from claiming the same username.
  const result = await redis.set(
    usernameKey,
    JSON.stringify(user),
    { NX: true }
  );

  if (result !== "OK") {
    const error = new Error("Username is already registered");
    error.statusCode = 409;
    throw error;
  }

  try {
    await redis.set(userKey, JSON.stringify(user));
  } catch (error) {
    await redis.del(usernameKey);
    throw error;
  }

  return user;
}

async function authenticateUser(username, password) {
  const normalizedUsername = username.trim().toLowerCase();

  const data = await redis.get(
    `user:username:${normalizedUsername}`
  );

  if (!data) {
    return null;
  }

  const user = JSON.parse(data);
  const validPassword = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!validPassword) {
    return null;
  }

  return user;
}

module.exports = {
  createAccessToken,
  registerUser,
  authenticateUser,
};