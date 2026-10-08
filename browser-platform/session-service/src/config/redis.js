const { createClient } = require("redis");

const redis = createClient({
  url: "redis://redis:6379",
});

redis.on("error", (err) => {
  console.error("Redis Error:", err);
});

async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    console.log("✅ Redis Connected");
  }
}

module.exports = {
  redis,
  connectRedis,
};