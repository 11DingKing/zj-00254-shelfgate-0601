const express = require("express");
const router = express.Router();
const db = require("../db/database");

const STATUS_MAP = {
  pending: "待审",
  reviewing: "审核中",
  rejected: "驳回",
  approved: "通过上架",
};

const SHELF_STATUS_MAP = {
  normal: "正常上架",
  off_shelf: "已下架",
};

router.get("/", (req, res) => {
  const { status, vendor, keyword, page = 1, pageSize = 10 } = req.query;
  const offset = (page - 1) * pageSize;

  let whereClause = [];
  let params = {};

  if (status && status !== "all") {
    whereClause.push("status = @status");
    params.status = status;
  }
  if (vendor && vendor !== "all") {
    whereClause.push("vendor = @vendor");
    params.vendor = vendor;
  }
  if (keyword) {
    whereClause.push("(app_name LIKE @keyword OR version_no LIKE @keyword)");
    params.keyword = `%${keyword}%`;
  }

  const whereSql =
    whereClause.length > 0 ? "WHERE " + whereClause.join(" AND ") : "";

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM app_versions ${whereSql}`)
    .get(params).count;

  const list = db
    .prepare(
      `
    SELECT * FROM app_versions 
    ${whereSql}
    ORDER BY submit_time DESC
    LIMIT @pageSize OFFSET @offset
  `,
    )
    .all({ ...params, pageSize: parseInt(pageSize), offset: parseInt(offset) });

  const result = list.map((item) => ({
    ...item,
    status_text: STATUS_MAP[item.status] || item.status,
    shelf_status_text:
      item.shelf_status === "off_shelf"
        ? "已下架"
        : item.status === "approved"
          ? "已上架"
          : "未上架",
  }));

  res.json({
    code: 0,
    data: {
      list: result,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    },
  });
});

router.get("/:id", (req, res) => {
  const version = db
    .prepare(
      `
    SELECT av.*, ac.name as category_name
    FROM app_versions av
    LEFT JOIN app_categories ac ON av.category_id = ac.id
    WHERE av.id = ?
  `,
    )
    .get(req.params.id);
  if (!version) {
    return res.json({ code: 1, message: "版本不存在" });
  }

  const records = db
    .prepare(
      `
    SELECT rr.*, 
           cv.id as checklist_version_id,
           cv.version_no as checklist_version_no,
           cv.description as checklist_version_desc,
           cv.created_at as checklist_created_at,
           cv.created_by as checklist_created_by,
           ct.name as template_name
    FROM review_records rr
    LEFT JOIN checklist_versions cv ON rr.checklist_version_id = cv.id
    LEFT JOIN checklist_templates ct ON cv.template_id = ct.id
    WHERE rr.version_id = ? 
    ORDER BY rr.review_round DESC
  `,
    )
    .all(req.params.id);

  const recordsWithItems = records.map((record) => {
    let items;
    if (record.checklist_version_id) {
      items = db
        .prepare(
          `
        SELECT rir.*, 
               cvi.check_item_code as code, 
               cvi.check_item_name as name, 
               cvi.check_item_description as description, 
               cvi.check_item_category as category,
               a.id as appeal_id,
               a.status as appeal_status,
               a.content as appeal_content,
               a.submitted_at as appeal_submitted_at,
               a.review_result as appeal_result,
               a.review_comment as appeal_review_comment
        FROM review_item_results rir
        JOIN checklist_version_items cvi ON rir.checklist_version_item_id = cvi.id
        LEFT JOIN appeals a ON rir.id = a.review_item_result_id
        WHERE rir.record_id = ?
        ORDER BY cvi.sort_order ASC
      `,
        )
        .all(record.id);
    } else {
      items = db
        .prepare(
          `
        SELECT rir.*, ci.code, ci.name, ci.description, ci.category,
               a.id as appeal_id,
               a.status as appeal_status,
               a.content as appeal_content,
               a.submitted_at as appeal_submitted_at,
               a.review_result as appeal_result,
               a.review_comment as appeal_review_comment
        FROM review_item_results rir
        JOIN check_items ci ON rir.check_item_id = ci.id
        LEFT JOIN appeals a ON rir.id = a.review_item_result_id
        WHERE rir.record_id = ?
        ORDER BY ci.sort_order ASC
      `,
        )
        .all(record.id);
    }
    return { ...record, items };
  });

  res.json({
    code: 0,
    data: {
      ...version,
      status_text: STATUS_MAP[version.status] || version.status,
      shelf_status_text:
        version.shelf_status === "off_shelf"
          ? "已下架"
          : version.status === "approved"
            ? "已上架"
            : "未上架",
      review_records: recordsWithItems,
    },
  });
});

router.post("/", (req, res) => {
  const { app_name, version_no, vendor, category_id } = req.body;

  if (!app_name || !version_no || !vendor) {
    return res.json({ code: 1, message: "应用名、版本号、厂商不能为空" });
  }

  if (category_id) {
    const category = db
      .prepare("SELECT * FROM app_categories WHERE id = ? AND is_active = 1")
      .get(category_id);
    if (!category) {
      return res.json({ code: 1, message: "选择的应用类别不存在或已停用" });
    }
  }

  try {
    const result = db
      .prepare(
        `
      INSERT INTO app_versions (app_name, version_no, vendor, category_id, status)
      VALUES (?, ?, ?, ?, 'pending')
    `,
      )
      .run(app_name, version_no, vendor, category_id || null);

    res.json({
      code: 0,
      data: { id: result.lastInsertRowid },
      message: "提交成功",
    });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      res.json({ code: 1, message: "该应用版本已存在" });
    } else {
      res.json({ code: 1, message: err.message });
    }
  }
});

router.get("/vendors/list", (req, res) => {
  const vendors = db
    .prepare(
      `
    SELECT DISTINCT vendor FROM app_versions ORDER BY vendor ASC
  `,
    )
    .all()
    .map((item) => item.vendor);

  res.json({
    code: 0,
    data: vendors,
  });
});

module.exports = router;
