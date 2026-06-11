const express = require("express");
const router = express.Router();
const db = require("../db/database");

router.get("/overview", (req, res) => {
  const total = db
    .prepare("SELECT COUNT(*) as count FROM app_versions")
    .get().count;
  const pending = db
    .prepare(
      "SELECT COUNT(*) as count FROM app_versions WHERE status = 'pending'",
    )
    .get().count;
  const reviewing = db
    .prepare(
      "SELECT COUNT(*) as count FROM app_versions WHERE status = 'reviewing'",
    )
    .get().count;
  const rejected = db
    .prepare(
      "SELECT COUNT(*) as count FROM app_versions WHERE status = 'rejected'",
    )
    .get().count;
  const approved = db
    .prepare(
      "SELECT COUNT(*) as count FROM app_versions WHERE status = 'approved'",
    )
    .get().count;
  const offShelf = db
    .prepare(
      "SELECT COUNT(*) as count FROM app_versions WHERE shelf_status = 'off_shelf'",
    )
    .get().count;

  const totalRejects =
    db.prepare("SELECT SUM(reject_count) as count FROM app_versions").get()
      .count || 0;

  res.json({
    code: 0,
    data: {
      total,
      pending,
      reviewing,
      rejected,
      approved,
      offShelf,
      totalRejects,
    },
  });
});

router.get("/by-vendor", (req, res) => {
  const vendors = db
    .prepare(
      `
    SELECT 
      vendor,
      COUNT(*) as total_versions,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(reject_count) as total_rejects,
      ROUND(
        CASE WHEN COUNT(*) > 0 
          THEN SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) 
          ELSE 0 
        END, 2
      ) as reject_rate
    FROM app_versions
    GROUP BY vendor
    ORDER BY reject_rate DESC, total_versions DESC
  `,
    )
    .all();

  res.json({
    code: 0,
    data: vendors,
  });
});

router.get("/by-check-item", (req, res) => {
  const items = db
    .prepare(
      `
    SELECT 
      ci.id,
      ci.code,
      ci.name,
      ci.category,
      COUNT(rir.id) as total_checks,
      SUM(CASE WHEN rir.result = 'fail' THEN 1 ELSE 0 END) as fail_count,
      ROUND(
        CASE WHEN COUNT(rir.id) > 0 
          THEN SUM(CASE WHEN rir.result = 'fail' THEN 1 ELSE 0 END) * 100.0 / COUNT(rir.id) 
          ELSE 0 
        END, 2
      ) as fail_rate
    FROM check_items ci
    LEFT JOIN review_item_results rir ON ci.id = rir.check_item_id
    GROUP BY ci.id
    ORDER BY fail_rate DESC, fail_count DESC
  `,
    )
    .all();

  res.json({
    code: 0,
    data: items,
  });
});

router.get("/top-violations", (req, res) => {
  const { limit = 5 } = req.query;

  const items = db
    .prepare(
      `
    SELECT 
      ci.id,
      ci.code,
      ci.name,
      ci.category,
      SUM(CASE WHEN rir.result = 'fail' THEN 1 ELSE 0 END) as fail_count
    FROM check_items ci
    LEFT JOIN review_item_results rir ON ci.id = rir.check_item_id
    GROUP BY ci.id
    HAVING fail_count > 0
    ORDER BY fail_count DESC
    LIMIT ?
  `,
    )
    .all(parseInt(limit));

  res.json({
    code: 0,
    data: items,
  });
});

module.exports = router;
