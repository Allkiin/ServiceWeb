const { MongoClient } = require("mongodb");

const client = new MongoClient("mongodb://localhost:27017");
let db;

async function connectDB() {
  await client.connect();
  db = client.db("myDB");
  console.log("Connected to MongoDB");
  return db;
}

function getDB() {
  return db;
}

module.exports = { connectDB, getDB };
