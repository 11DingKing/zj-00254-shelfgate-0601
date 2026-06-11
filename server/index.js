const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { initAll } = require("./db/schema");

const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initAll();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/versions", require("./routes/versions"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/stats", require("./routes/stats"));

app.get("/api/health", (req, res) => {
  res.json({ code: 0, message: "ok" });
});

app.listen(PORT, () => {
  console.log(`审核后台服务已启动: http://localhost:${PORT}`);
});
