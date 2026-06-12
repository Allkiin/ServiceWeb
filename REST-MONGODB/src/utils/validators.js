const { ObjectId } = require("mongodb");

function parseObjectId(id, res) {
  try {
    return new ObjectId(id);
  } catch {
    res.status(400).send({ message: "Invalid id format" });
    return null;
  }
}

module.exports = { parseObjectId };
