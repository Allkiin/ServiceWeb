const express = require("express");
const { getDB } = require("../db");
const { CreateCategorySchema } = require("../schemas/category.schema");
const { parseObjectId } = require("../utils/validators");

const router = express.Router();

router.get("/", async (req, res) => {
  const db = getDB();
  const categories = await db.collection("categories").find({}).toArray();
  res.send(categories);
});

router.get("/:id", async (req, res) => {
  const db = getDB();
  const id = parseObjectId(req.params.id, res);
  if (!id) return;

  const category = await db.collection("categories").findOne({ _id: id });
  if (!category) return res.status(404).send({ message: "Not found" });
  res.send(category);
});

router.post("/", async (req, res) => {
  const db = getDB();
  const result = CreateCategorySchema.safeParse(req.body);
  if (!result.success) return res.status(400).send(result);

  const { name } = result.data;
  const ack = await db.collection("categories").insertOne({ name });
  res.send({ _id: ack.insertedId, name });
});

router.put("/:id", async (req, res) => {
  const db = getDB();
  const id = parseObjectId(req.params.id, res);
  if (!id) return;

  const result = CreateCategorySchema.safeParse(req.body);
  if (!result.success) return res.status(400).send(result);

  const { name } = result.data;
  const category = await db
    .collection("categories")
    .findOneAndReplace({ _id: id }, { name }, { returnDocument: "after" });

  if (!category) return res.status(404).send({ message: "Not found" });
  res.send(category);
});

router.delete("/:id", async (req, res) => {
  const db = getDB();
  const id = parseObjectId(req.params.id, res);
  if (!id) return;

  const category = await db.collection("categories").findOneAndDelete({ _id: id });
  if (!category) return res.status(404).send({ message: "Not found" });
  res.send(category);
});

module.exports = router;
