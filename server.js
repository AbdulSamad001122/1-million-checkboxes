import path from "node:path";
import { createServer } from "node:http";

import "dotenv/config";

import express from "express";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8000;

const CHECK_BOXES_COUNT = 100;

const checkboxes = {};

app.use(express.static(path.resolve(process.cwd(), "public")));

app.get("/health", (req, res) => {
  res.send("Server is healthy!");
});

io.on("connection", (socket) => {
  console.log(`A user connected with this ${socket.id}`);

  socket.on("client:checkbox:change", (data) => {
    console.log(`This ${data.id} is changed to ${data.checked}`);

    checkboxes[data.id] = {
      state: data.checked,
    };

    console.log("checkboxes", checkboxes);

    socket.broadcast.emit("server:checkbox:change", data);
  });
});

app.get("/checkboxes", (req, res) => {
  return res.status(200).json(checkboxes);
});

server.listen(PORT, () => {
  console.log(`Server is listening on this http://localhost:${PORT}/`);
});
