function startCleanupJob() {

  setInterval(() => {
    console.log("cleanup worker running...");
  }, 30000);

}

module.exports = {
  startCleanupJob
};