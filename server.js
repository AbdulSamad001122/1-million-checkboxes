import path from "node:path";
import { createServer } from "node:http";

import "dotenv/config";

import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { publisher, subscriber, getOldData } from "./redis.connection.js";

const CHECK_BOXES_STATE_KEY = "checkbox-state";
const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(cors());

const PORT = process.env.PORT || 8000;

const CHECK_BOXES_COUNT = 100;

const checkboxes = {};

subscriber.subscribe(
  "client-to-internal-server:checkbox:change",
  (err, data) => {
    if (err) {
      console.log("Error while subscribing the data", err.message);
    } else {
      console.log("Data is subscribed successfully", JSON.parse(data));
    }
  },
);

app.use(express.static(path.resolve(process.cwd(), "public")));

app.get("/health", (req, res) => {
  res.send("Server is healthy!");
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("client:checkbox:change", async (data) => {
    console.log("Checkbox changed:", data);

    await publisher.publish(
      "client-to-internal-server:checkbox:change",
      JSON.stringify(data),
    );
  });
});

subscriber.subscribe("client-to-internal-server:checkbox:change");

subscriber.on("message", async (channel, message) => {
  const data = JSON.parse(message);

  console.log("Global Redis event:", data);

  await getOldData.set("CHECK_BOXES_STATE_KEY", JSON.stringify(data));

  io.emit("server:checkbox:change", data);
});

app.get("/checkboxes", async (req, res) => {
  const raw = await getOldData.get(CHECK_BOXES_STATE_KEY);

  const rawToJson = JSON.parse(raw);
  console.log("got this data from redis ", rawToJson);

  return res.status(200).json(rawToJson);
});

server.listen(PORT, () => {
  console.log(`Server is listening on this http://localhost:${PORT}/`);
});
