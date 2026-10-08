




/*const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { spawn } = require("child_process");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 7000;

const KASM_HOST = process.env.KASM_HOST || "host.docker.internal";
const KASM_AUDIO_PORT = process.env.KASM_AUDIO_PORT || "4901";

const KASM_USER = process.env.KASM_USER || "kasm_user";
const KASM_PASSWORD =
    process.env.KASM_PASSWORD || "SecurePassword123!";

const KASM_AUDIO_URL =
    `wss://${KASM_HOST}:${KASM_AUDIO_PORT}/`;

app.use(express.static("/app/public"));

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "firefox-audio-bridge",
        kasmAudio: KASM_AUDIO_URL
    });
});

app.get("/stream", (req, res) => {

    console.log("[HTTP] Audio client connected");

    res.writeHead(200, {
        "Content-Type": "audio/ogg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Connection": "keep-alive",
        "Transfer-Encoding": "chunked",
        "Access-Control-Allow-Origin": "*"
    });

    const auth = Buffer
        .from(`${KASM_USER}:${KASM_PASSWORD}`)
        .toString("base64");

    console.log(
        `[WS] Connecting to ${KASM_AUDIO_URL}`
    );

    const ws = new WebSocket(KASM_AUDIO_URL, {
        rejectUnauthorized: false,

        headers: {
            Authorization: `Basic ${auth}`
        }
    });

    ws.binaryType = "nodebuffer";

    let ffmpeg;

    ws.on("open", () => {

        console.log("[WS] Connected to Kasm audio service");

        ffmpeg = spawn("ffmpeg", [
            "-hide_banner",
            "-loglevel",
            "warning",

            "-fflags",
            "+nobuffer",

            "-i",
            "pipe:0",

            "-vn",

            "-map",
            "0:a:0",

            "-af",
            "aresample=async=1:first_pts=0",

            "-c:a",
            "libopus",
            "-b:a",
            "96k",
            "-vbr",
            "on",

            "-application",
            "audio",

            "-frame_duration",
            "20",

            "-f",
            "ogg",

            "pipe:1"
        ]);

        ffmpeg.stdout.on("data", chunk => {

            if (!res.destroyed) {
                res.write(chunk);
            }

        });

        ffmpeg.stderr.on("data", data => {

            const message = data
                .toString()
                .trim();

            if (message) {
                console.log(`[FFmpeg] ${message}`);
            }

        });

        ffmpeg.on("close", code => {

            console.log(
                `[FFmpeg] exited with code ${code}`
            );

            if (!res.destroyed) {
                res.end();
            }
        });

        ws.on("message", data => {

            if (
                ffmpeg &&
                ffmpeg.stdin &&
                !ffmpeg.stdin.destroyed
            ) {
                ffmpeg.stdin.write(data);
            }

        });
    });

    ws.on("unexpected-response", (request, response) => {

        console.error(
            `[WS] Unexpected response: HTTP ${response.statusCode}`
        );

        response.on("data", chunk => {
            console.error(
                `[WS] ${chunk.toString()}`
            );
        });

        if (!res.destroyed) {
            res.statusCode = 502;
            res.end("Kasm audio authentication/connection failed");
        }
    });

    ws.on("error", error => {

        console.error(
            "[WS] Error:",
            error.message
        );

        if (!res.destroyed) {
            res.end();
        }
    });

    ws.on("close", (code, reason) => {

        console.log(
            `[WS] Closed: ${code} ${reason.toString()}`
        );

        if (ffmpeg) {

            try {
                ffmpeg.stdin.end();
            } catch { }

        }

        if (!res.destroyed) {
            res.end();
        }
    });

    req.on("close", () => {

        console.log(
            "[HTTP] Audio client disconnected"
        );

        try {
            ws.close();
        } catch { }

        if (ffmpeg) {

            try {
                ffmpeg.kill("SIGTERM");
            } catch { }

        }

    });
});

server.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("======================================");
    console.log(" Firefox Audio Bridge");
    console.log("======================================");
    console.log(`HTTP server:      http://0.0.0.0:${PORT}`);
    console.log(`Kasm audio:       ${KASM_AUDIO_URL}`);
    console.log(`Kasm user:        ${KASM_USER}`);
    console.log("======================================");
    console.log("");

});*/


const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { spawn } = require("child_process");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 7000;

const KASM_HOST = process.env.KASM_HOST || "workspace_firefox";
const KASM_AUDIO_PORT = process.env.KASM_AUDIO_PORT || "4901";

const KASM_USER = process.env.KASM_USER || "kasm_user";
const KASM_PASSWORD =
process.env.KASM_PASSWORD || "SecurePassword123!";

const KASM_AUDIO_URL =
`wss://${KASM_HOST}:${KASM_AUDIO_PORT}/`;

app.use(express.static("/app/public"));

app.get("/health", (req, res) => {
res.json({
status: "ok",
service: "firefox-audio-bridge",
kasmAudio: KASM_AUDIO_URL
});
});

app.get("/stream", (req, res) => {


console.log("[HTTP] Audio client connected");

let closed = false;
let ws = null;
let ffmpeg = null;

const cleanup = () => {

    if (closed) {
        return;
    }

    closed = true;

    console.log("[CLEANUP] Closing audio pipeline");

    if (ws) {
        try {
            if (
                ws.readyState === WebSocket.OPEN ||
                ws.readyState === WebSocket.CONNECTING
            ) {
                ws.close();
            }
        } catch {}
    }

    if (ffmpeg) {

        try {
            if (
                ffmpeg.stdin &&
                !ffmpeg.stdin.destroyed
            ) {
                ffmpeg.stdin.end();
            }
        } catch {}

        setTimeout(() => {

            try {
                if (!ffmpeg.killed) {
                    ffmpeg.kill("SIGTERM");
                }
            } catch {}

        }, 250);
    }

    if (!res.destroyed) {
        try {
            res.end();
        } catch {}
    }
};

res.writeHead(200, {
    "Content-Type": "audio/ogg",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Connection": "keep-alive",
    "Transfer-Encoding": "chunked",
    "Access-Control-Allow-Origin": "*"
});

const auth = Buffer
    .from(`${KASM_USER}:${KASM_PASSWORD}`)
    .toString("base64");

console.log(
    `[WS] Connecting to ${KASM_AUDIO_URL}`
);

ws = new WebSocket(KASM_AUDIO_URL, {
    rejectUnauthorized: false,

    headers: {
        Authorization: `Basic ${auth}`
    }
});

ws.binaryType = "nodebuffer";

ws.on("open", () => {

    if (closed) {
        return;
    }

    console.log("[WS] Connected to Kasm audio service");

    /*
     * Kasm already provides a timestamped MPEG-TS audio stream.
     *
     * We decode it and encode to Opus, but DO NOT use:
     *
     *     first_pts=0
     *
     * because that resets the incoming timeline.
     */

    ffmpeg = spawn("ffmpeg", [

        "-hide_banner",

        "-loglevel",
        "warning",

        /*
         * Minimize input buffering.
         */
        "-fflags",
        "+nobuffer",

        "-flags",
        "low_delay",

        /*
         * Read Kasm MPEG-TS.
         */
        "-f",
        "mpegts",

        "-i",
        "pipe:0",

        "-vn",

        "-map",
        "0:a:0",

        /*
         * Keep timestamps.
         */
        "-copyts",

        "-start_at_zero",

        /*
         * Convert to Opus.
         */
        "-c:a",
        "libopus",

        "-b:a",
        "96k",

        "-vbr",
        "on",

        "-application",
        "lowdelay",

        /*
         * 20 ms Opus packets.
         */
        "-frame_duration",
        "20",

        /*
         * Live Ogg output.
         */
        "-f",
        "ogg",

        "pipe:1"
    ]);

    ffmpeg.stdout.on("data", chunk => {

        if (closed || res.destroyed) {
            return;
        }

        try {
            const ok = res.write(chunk);

            if (!ok) {
                console.log(
                    "[HTTP] Audio output backpressure"
                );
            }

        } catch (error) {

            console.log(
                "[HTTP] Write failed:",
                error.message
            );

            cleanup();
        }
    });

    ffmpeg.stderr.on("data", data => {

        const message = data
            .toString()
            .trim();

        if (message) {
            console.log(`[FFmpeg] ${message}`);
        }
    });

    ffmpeg.on("error", error => {

        console.error(
            "[FFmpeg] Process error:",
            error.message
        );

        cleanup();
    });

    ffmpeg.on("close", code => {

        console.log(
            `[FFmpeg] exited with code ${code}`
        );

        if (!closed && !res.destroyed) {
            try {
                res.end();
            } catch {}
        }
    });

    ws.on("message", data => {

        if (
            closed ||
            !ffmpeg ||
            !ffmpeg.stdin ||
            ffmpeg.stdin.destroyed
        ) {
            return;
        }

        try {
            ffmpeg.stdin.write(data);

        } catch (error) {

            /*
             * Prevent the EPIPE crash seen previously.
             */
            console.log(
                "[FFmpeg] stdin write failed:",
                error.message
            );

            cleanup();
        }
    });
});

ws.on("unexpected-response", (request, response) => {

    console.error(
        `[WS] Unexpected response: HTTP ${response.statusCode}`
    );

    response.on("data", chunk => {

        console.error(
            `[WS] ${chunk.toString()}`
        );

    });

    cleanup();
});

ws.on("error", error => {

    console.error(
        "[WS] Error:",
        error.message
    );

    cleanup();
});

ws.on("close", (code, reason) => {

    console.log(
        `[WS] Closed: ${code} ${reason.toString()}`
    );

    cleanup();
});

req.on("close", () => {

    console.log(
        "[HTTP] Audio client disconnected"
    );

    cleanup();
});


});

server.listen(PORT, "0.0.0.0", () => {


console.log("");
console.log("======================================");
console.log(" Firefox Audio Bridge");
console.log("======================================");
console.log(`HTTP server:      http://0.0.0.0:${PORT}`);
console.log(`Kasm audio:       ${KASM_AUDIO_URL}`);
console.log(`Kasm user:        ${KASM_USER}`);
console.log("======================================");
console.log("");


});
