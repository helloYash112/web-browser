
const crypto = require("crypto");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { spawn } = require("child_process");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 7000);
const BRIDGE_SECRET = process.env.AUDIO_BRIDGE_SECRET || "";
const KASM_USERNAME = process.env.KASM_USERNAME || "kasm_user";
const KASM_PASSWORD = process.env.KASM_PASSWORD || "vncpassword";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KASM_AUTH =
  "Basic " +
  Buffer.from(`${KASM_USERNAME}:${KASM_PASSWORD}`).toString("base64");

function secretMatches(value) {
  const expected = Buffer.from(BRIDGE_SECRET);
  const actual = Buffer.from(String(value || ""));

  return (
    expected.length > 0 &&
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "audio-bridge",
  });
});

app.get("/stream", (req, res) => {
  if (!secretMatches(req.get("x-audio-bridge-secret"))) {
    return res.status(401).send("Unauthorized");
  }

  const sessionId = String(req.get("x-audio-session-id") || "");
  const containerName = String(req.get("x-audio-container") || "");

  if (
    !UUID_PATTERN.test(sessionId) ||
    containerName !== `firefox-${sessionId}`
  ) {
    return res.status(400).send("Invalid browser session");
  }

  // Docker DNS resolves this name on browser-platform-net.
  const audioUrl = `wss://${containerName}:4901/`;

  console.log(`[AUDIO] Connecting session ${sessionId}`);

  let ws;
  let ffmpeg;
  let stopped = false;

  function cleanup() {
    if (stopped) return;
    stopped = true;

    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.terminate();
        }
      } catch {}
    }

    if (ffmpeg) {
      try {
        if (ffmpeg.stdin && !ffmpeg.stdin.destroyed) {
          ffmpeg.stdin.end();
        }
      } catch {}

      try {
        if (ffmpeg.exitCode === null && !ffmpeg.killed) {
          ffmpeg.kill("SIGTERM");
        }
      } catch {}
    }
  }

  function fail(message) {
    if (!res.headersSent) {
      res.status(502).type("text/plain").end(message);
    } else if (!res.writableEnded && !res.destroyed) {
      res.end();
    }

    cleanup();
  }

  res.on("close", cleanup);
  res.on("error", cleanup);

  ws = new WebSocket(audioUrl, {
    rejectUnauthorized: false,
    perMessageDeflate: false,
    headers: {
      Authorization: KASM_AUTH,
    },
  });

  ws.binaryType = "nodebuffer";

  ws.on("open", () => {
    if (stopped) return;

    ffmpeg = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel", "warning",
        "-fflags", "+nobuffer",
        "-flags", "low_delay",
        "-f", "mpegts",
        "-i", "pipe:0",
        "-vn",
        "-map", "0:a:0",
        "-copyts",
        "-start_at_zero",
        "-c:a", "libopus",
        "-b:a", "96k",
        "-vbr", "on",
        "-application", "lowdelay",
        "-frame_duration", "20",
        "-flush_packets", "1",
        "-f", "ogg",
        "-page_duration", "20000",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    res.writeHead(200, {
      "Content-Type": "audio/ogg",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    });

    ffmpeg.stdout.on("data", (chunk) => {
      if (stopped || res.destroyed) return;

      if (!res.write(chunk)) {
        ffmpeg.stdout.pause();
      }
    });

    res.on("drain", () => {
      if (ffmpeg && ffmpeg.stdout && !stopped) {
        ffmpeg.stdout.resume();
      }
    });

    ffmpeg.stderr.on("data", (data) => {
      const message = data.toString().trim();
      if (message) console.log(`[FFmpeg ${sessionId}] ${message}`);
    });

    ffmpeg.stdin.on("error", (error) => {
      if (!stopped && error.code !== "EPIPE") {
        console.error(`[FFmpeg ${sessionId}] ${error.message}`);
      }
    });

    ffmpeg.on("error", (error) => {
      console.error(`[FFmpeg ${sessionId}] ${error.message}`);
      fail("Audio transcoder failed");
    });

    ffmpeg.on("close", (code) => {
      if (stopped) return;

      console.log(`[FFmpeg ${sessionId}] exited with code ${code}`);

      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }

      cleanup();
    });

    ws.on("message", (data, isBinary) => {
      if (
        stopped ||
        !isBinary ||
        !ffmpeg ||
        !ffmpeg.stdin ||
        ffmpeg.stdin.destroyed
      ) {
        return;
      }

      if (!ffmpeg.stdin.write(data)) {
        ws.pause();
        ffmpeg.stdin.once("drain", () => {
          if (!stopped && ws.readyState === WebSocket.OPEN) {
            ws.resume();
          }
        });
      }
    });
  });

  ws.on("error", (error) => {
    console.error(`[AUDIO ${sessionId}] ${error.message}`);
    fail("Firefox audio source is unavailable");
  });

  ws.on("close", () => {
    if (!stopped) {
      console.log(`[AUDIO ${sessionId}] Source disconnected`);
      fail("Firefox audio source disconnected");
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Audio bridge listening on port ${PORT}`);
});
