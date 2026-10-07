const app = require("./src/app");

const {
  startCleanupJob
} = require("./src/services/cleanup.service");

const PORT = 3000;

startCleanupJob();

app.listen(PORT, () => {
  console.log(
    `Session Service Running On Port ${PORT}`
  );
});