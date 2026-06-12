const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./src/swagger");

const rootRoutes = require("./src/routes/root.routes");
const productsRoutes = require("./src/routes/products.routes");
const usersRoutes = require("./src/routes/users.routes");
const f2pGamesRoutes = require("./src/routes/f2pGames.routes");
const ordersRoutes = require("./src/routes/orders.routes");
const reviewsRoutes = require("./src/routes/reviews.routes");

const app = express();
const port = 8000;

app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/", rootRoutes);
app.use("/products", productsRoutes);
app.use("/users", usersRoutes);
app.use("/f2p-games", f2pGamesRoutes);
app.use("/orders", ordersRoutes);
app.use("/reviews", reviewsRoutes);

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
  console.log(`API docs available at http://localhost:${port}/api-docs`);
});
