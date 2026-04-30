import path from "node:path";
import { createServer } from "node:http";

import "dotenv/config";

import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { publisher, subscriber, getOldData } from "./redis.connection.js";
import { requireAuth } from "./middleware/auth.js";

const PORT = process.env.PORT || 8000;
const CHECK_BOXES_STATE_KEY = "checkboxes:state";
const REDIS_CHANNEL = "client-to-internal-server:checkbox:change";

const rateLimitingHashMap = {};

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.static(path.resolve(process.cwd(), "public")));

app.get("/health", (req, res) => {
  res.send("Server is healthy!");
});

app.get("/checkboxes", async (req, res) => {
  const raw = await getOldData.hgetall(CHECK_BOXES_STATE_KEY);
  console.log("got this data from redis", raw);
  return res.status(200).json(raw);
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("client:checkbox:change", async (data) => {


    console.log("Checkbox changed:", data);
    await publisher.publish(REDIS_CHANNEL, JSON.stringify(data));
  });
});

subscriber.subscribe(REDIS_CHANNEL);

subscriber.on("message", async (channel, message) => {
  const data = JSON.parse(message);
  console.log("Global Redis event:", data);
  await getOldData.hset(CHECK_BOXES_STATE_KEY, data.id, data.checked);
  io.emit("server:checkbox:change", data);
});

server.listen(PORT, () => {
  console.log(`Server is listening on this http://localhost:${PORT}/`);
});
