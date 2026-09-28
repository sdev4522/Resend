const router = require("express").Router();
const path = require("path");
const fs = require("fs");

let cachedSpec = null;

router.get("/openapi.json", (req, res) => {
  if (!cachedSpec) {
    try {
      const filePath = path.resolve(__dirname, "../../docs/openapi.json");
      const content = fs.readFileSync(filePath, "utf-8");
      cachedSpec = JSON.parse(content);
    } catch (err) {
      return res.status(500).json({ error: "Failed to load OpenAPI spec" });
    }
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json(cachedSpec);
});

module.exports = router;
