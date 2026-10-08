const app = require("./src/app");

const {
  startCleanupJob,
} = require("./src/services/cleanup.service");

const {
  connectRedis,
} = require("./src/config/redis");

const PORT = 3000;

async function start() {
  await connectRedis();

  startCleanupJob();

  app.listen(PORT, () => {
    console.log(
      `Session Service Running On Port ${PORT}`
    );
  });
}

start();
