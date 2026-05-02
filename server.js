import path from "node:path";
import { createServer } from "node:http";

import "dotenv/config";

import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { publisher, subscriber, getOldData } from "./redis.connection.js";
import { requireAuth } from "./middleware/auth.js";
import { verifyToken } from "./middleware/verifyToken.js";
import { group } from "node:console";

const PORT = process.env.PORT || 8000;
const CHECK_BOXES_STATE_KEY = "checkboxes:state";
const REDIS_CHANNEL = "client-to-internal-server:checkbox:change";

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), "public")));

app.get("/health", (req, res) => {
  res.sendStatus(200);
});

app.post("/api/callback", async (req, res) => {
  const { code, redirectUri } = req.body;

  if (!code || !redirectUri) {
    return res.status(400).json({ error: "Missing code or redirectUri" });
  }

  try {
    const response = await fetch(process.env.OIDC_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Token exchange failed" });
  }
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("client:checkbox:change", async (data) => {
    const user = await verifyToken(data.token);
    if (!user) {
      socket.emit("error", { message: "Unauthorized" });
      return;
    }

    const rateLimitKey = `rate-limit:${user.sub}`;
    const count = await getOldData.incr(rateLimitKey);
    if (count === 1) await getOldData.expire(rateLimitKey, 5);
    if (count > 3) {
      socket.emit("error", {
        message: "Rate limit exceeded. Max 3 per 5 seconds.",
      });
      return;
    }

    const { token: _, ...payload } = data;
    console.log(`User ${user.sub} changed checkbox`, payload);
    publisher
      .publish(REDIS_CHANNEL, JSON.stringify(payload))
      .catch((err) => console.error("Publish error:", err));
  });
});

subscriber.subscribe(REDIS_CHANNEL);

subscriber.on("message", (channel, message) => {
  const data = JSON.parse(message);
  console.log("Global Redis event:", data);
  getOldData
    .hset(CHECK_BOXES_STATE_KEY, data.id, data.checked)
    .catch((err) => console.error("HSET error:", err));
  io.emit("server:checkbox:change", data);
});

app.get("/checkboxes", async (req, res) => {
  const raw = await getOldData.hgetall(CHECK_BOXES_STATE_KEY);
  return res.status(200).json(raw);
});

server.listen(PORT, () => {
  console.log(`Server is listening on this http://localhost:${PORT}/`);
});
