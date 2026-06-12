const postgres = require("postgres");

const sql = postgres({ db: "mydb", user: "user", password: "password" });

module.exports = sql;
