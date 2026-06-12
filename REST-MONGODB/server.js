const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { connectDB } = require("./src/db");

// Routes
const rootRoutes = require("./src/routes/root.routes");
const categoriesRoutes = require("./src/routes/categories.routes");
const productsRoutes = require("./src/routes/products.routes");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 8000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Make io available to routes
app.set("io", io);

// Routes
app.use("/", rootRoutes);
app.use("/categories", categoriesRoutes);
app.use("/products", productsRoutes);

// WebSockets
io.on("connection", (socket) => {
  console.log("user connected");
  socket.on("disconnect", () => console.log("user disconnected"));
});

// Start server
connectDB().then(() => {
  server.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});
