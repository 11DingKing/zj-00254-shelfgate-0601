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

router.get("/by-category", (req, res) => {
  const categories = db
    .prepare(
      `
    SELECT 
      ac.id,
      ac.name as category_name,
      COUNT(DISTINCT av.id) as total,
      SUM(CASE WHEN av.status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN av.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN av.status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN av.status = 'reviewing' THEN 1 ELSE 0 END) as reviewing,
      ROUND(
        CASE WHEN COUNT(DISTINCT av.id) > 0 
          THEN SUM(CASE WHEN av.status = 'approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT av.id) 
          ELSE 0 
        END, 1
      ) as pass_rate
    FROM app_categories ac
    LEFT JOIN app_versions av ON ac.id = av.category_id
    WHERE ac.is_active = 1
    GROUP BY ac.id
    ORDER BY total DESC
  `,
    )
    .all();

  res.json({
    code: 0,
    data: categories,
  });
});

router.get("/by-template", (req, res) => {
  const templates = db
    .prepare(
      `
    SELECT 
      ct.id,
      ct.name as template_name,
      COUNT(DISTINCT rr.id) as total,
      SUM(CASE WHEN rr.result = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN rr.result = 'rejected' THEN 1 ELSE 0 END) as rejected,
      COUNT(DISTINCT ctm.category_id) as category_count,
      (SELECT version_no FROM checklist_versions WHERE template_id = ct.id ORDER BY created_at DESC LIMIT 1) as latest_version,
      ROUND(
        CASE WHEN COUNT(DISTINCT rr.id) > 0 
          THEN SUM(CASE WHEN rr.result = 'approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT rr.id) 
          ELSE 0 
        END, 1
      ) as pass_rate
    FROM checklist_templates ct
    LEFT JOIN checklist_versions cv ON ct.id = cv.template_id
    LEFT JOIN review_records rr ON cv.id = rr.checklist_version_id
    LEFT JOIN category_template_mapping ctm ON ct.id = ctm.template_id
    WHERE ct.is_active = 1
    GROUP BY ct.id
    ORDER BY total DESC
  `,
    )
    .all();

  res.json({
    code: 0,
    data: templates,
  });
});

router.get("/by-checklist-version", (req, res) => {
  const versions = db
    .prepare(
      `
    SELECT 
      cv.id as version_id,
      cv.version_no as version_number,
      cv.description,
      cv.created_at,
      ct.name as template_name,
      COUNT(DISTINCT rr.id) as total,
      SUM(CASE WHEN rr.result = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN rr.result = 'rejected' THEN 1 ELSE 0 END) as rejected,
      (SELECT COUNT(*) FROM checklist_version_items WHERE checklist_version_id = cv.id) as item_count
    FROM checklist_versions cv
    JOIN checklist_templates ct ON cv.template_id = ct.id
    LEFT JOIN review_records rr ON cv.id = rr.checklist_version_id
    GROUP BY cv.id
    ORDER BY cv.created_at DESC
  `,
    )
    .all();

  res.json({
    code: 0,
    data: versions,
  });
});

router.get("/appeals", (req, res) => {
  const stats = db
    .prepare(
      `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN review_result = 'accepted' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN review_result = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM appeals
  `,
    )
    .get();

  res.json({
    code: 0,
    data: stats,
  });
});

router.get("/appeals-by-vendor", (req, res) => {
  const vendors = db
    .prepare(
      `
    SELECT 
      vendor_name as vendor,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN review_result = 'accepted' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN review_result = 'rejected' THEN 1 ELSE 0 END) as rejected,
      ROUND(
        CASE WHEN COUNT(*) > 0 
          THEN SUM(CASE WHEN review_result = 'accepted' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) 
          ELSE 0 
        END, 1
      ) as accept_rate
    FROM appeals
    GROUP BY vendor_name
    ORDER BY total DESC
  `,
    )
    .all();

  res.json({
    code: 0,
    data: vendors,
  });
});

module.exports = router;
