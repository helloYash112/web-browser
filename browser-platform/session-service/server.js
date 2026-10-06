const express = require("express");
const crypto = require("crypto");

const app = express();

const sessions = new Map();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/session", async (req, res) => {

  const sessionId = crypto.randomUUID();

  const containerName = `firefox-${sessionId}`;

  const container = await docker.createContainer({
    Image: "kasmweb/firefox:1.17.0",

    name: containerName,

    Env: [
      "DISABLE_AUTH=true",
      "VNC_RESOLUTION=1280x720",
      "MAX_FRAME_RATE=30"
    ],

    HostConfig: {
      ShmSize: 2147483648
    }
  });

  await container.start();

  sessions.set(sessionId, {
    containerName
  });

  res.json({
    sessionId,
    containerName
  });

});

app.listen(3000, () => {
  console.log("Session Service Running");
});
const Docker = require("dockerode");

const docker = new Docker({
  socketPath: "/var/run/docker.sock",
});

app.get("/sessions", (req,res)=>{
    res.json(
      [...sessions.entries()]
    );
});

app.delete("/session/:id", async (req,res)=>{

   const session = sessions.get(req.params.id);

   if(!session){
      return res.status(404).send();
   }

   const container =
      docker.getContainer(
         session.containerName
      );

   await container.stop();
   await container.remove();

   sessions.delete(req.params.id);

   res.json({
      deleted:true
   });

});
