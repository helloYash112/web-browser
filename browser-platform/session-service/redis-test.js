const { createClient } = require("redis");

async function main() {
  const client = createClient({
    socket: {
      host: "redis",
      port: 6379,
    },
  });

  client.on("error", (err) => {
    console.error("REDIS ERROR:", err);
  });

  await client.connect();

  console.log("CONNECTED");

  await client.set("name", "yash");

  const value = await client.get("name");

  console.log("VALUE:", value);

  await client.quit();
}

main().catch(console.error);