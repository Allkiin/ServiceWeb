const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../db");
const { CreateProductSchema, UpdateProductSchema } = require("../schemas/product.schema");
const { parseObjectId } = require("../utils/validators");

const router = express.Router();

// Aggregation pipeline for products + categories
function productAggregation(matchStage = {}) {
  return [
    { $match: matchStage },
    {
      $lookup: {
        from: "categories",
        localField: "categoryIds",
        foreignField: "_id",
        as: "categories",
      },
    },
  ];
}

router.get("/", async (req, res) => {
  const db = getDB();
  const result = await db
    .collection("products")
    .aggregate(productAggregation())
    .toArray();
  res.send(result);
});

router.get("/:id", async (req, res) => {
  const db = getDB();
  const id = parseObjectId(req.params.id, res);
  if (!id) return;

  const result = await db
    .collection("products")
    .aggregate(productAggregation({ _id: id }))
    .toArray();

  if (result.length === 0) return res.status(404).send({ message: "Not found" });
  res.send(result[0]);
});

router.post("/", async (req, res, next) => {
  const db = getDB();
  const result = CreateProductSchema.safeParse(req.body);
  if (!result.success) return res.status(400).send(result);

  const { name, about, price, categoryIds } = result.data;
  const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

  const ack = await db
    .collection("products")
    .insertOne({ name, about, price, categoryIds: categoryObjectIds });

  const product = { _id: ack.insertedId, name, about, price, categoryIds: categoryObjectIds };

  // Emit WebSocket event
  const io = req.app.get("io");
  if (io) io.emit("products", { event: "created", product });

  res.send(product);
});

router.put("/:id", async (req, res) => {
  const db = getDB();
  const id = parseObjectId(req.params.id, res);
  if (!id) return;

  const result = CreateProductSchema.safeParse(req.body);
  if (!result.success) return res.status(400).send(result);

  const { name, about, price, categoryIds } = result.data;
  const categoryObjectIds = categoryIds.map((cid) => new ObjectId(cid));

  const product = await db
    .collection("products")
    .findOneAndReplace(
      { _id: id },
      { name, about, price, categoryIds: categoryObjectIds },
      { returnDocument: "after" }
    );

  if (!product) return res.status(404).send({ message: "Not found" });

  const io = req.app.get("io");
  if (io) io.emit("products", { event: "updated", product });

  res.send(product);
});

router.patch("/:id", async (req, res) => {
  const db = getDB();
  const id = parseObjectId(req.params.id, res);
  if (!id) return;

  const result = UpdateProductSchema.safeParse(req.body);
  if (!result.success) return res.status(400).send(result);

  const { categoryIds, ...rest } = result.data;
  const update = { ...rest };
  if (categoryIds) {
    update.categoryIds = categoryIds.map((cid) => new ObjectId(cid));
  }

  const product = await db
    .collection("products")
    .findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });

  if (!product) return res.status(404).send({ message: "Not found" });

  const io = req.app.get("io");
  if (io) io.emit("products", { event: "updated", product });

  res.send(product);
});

router.delete("/:id", async (req, res) => {
  const db = getDB();
  const id = parseObjectId(req.params.id, res);
  if (!id) return;

  const product = await db.collection("products").findOneAndDelete({ _id: id });
  if (!product) return res.status(404).send({ message: "Not found" });

  const io = req.app.get("io");
  if (io) io.emit("products", { event: "deleted", product });

  res.send(product);
});

module.exports = router;
