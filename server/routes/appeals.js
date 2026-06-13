const express = require("express");
const router = express.Router();
const db = require("../db/database");

router.get("/", (req, res) => {
  const { status, version_id, page = 1, pageSize = 10 } = req.query;
  const offset = (page - 1) * pageSize;

  let whereClause = [];
  let params = {};

  if (status && status !== "all") {
    whereClause.push("a.status = @status");
    params.status = status;
  }
  if (version_id) {
    whereClause.push("av.id = @version_id");
    params.version_id = version_id;
  }

  const whereSql =
    whereClause.length > 0 ? "WHERE " + whereClause.join(" AND ") : "";

  const total = db
    .prepare(
      `
    SELECT COUNT(*) as count 
    FROM appeals a
    JOIN review_item_results rir ON a.review_item_result_id = rir.id
    JOIN review_records rr ON rir.record_id = rr.id
    JOIN app_versions av ON rr.version_id = av.id
    ${whereSql}
  `,
    )
    .get(params).count;

  const list = db
    .prepare(
      `
    SELECT a.*, 
           rir.result as item_result,
           rir.comment as item_comment,
           rir.check_item_id,
           rir.checklist_version_item_id,
           cvi.check_item_code,
           cvi.check_item_name,
           cvi.check_item_category,
           rr.id as record_id,
           rr.review_round,
           av.id as version_id,
           av.app_name,
           av.version_no,
           av.vendor
    FROM appeals a
    JOIN review_item_results rir ON a.review_item_result_id = rir.id
    JOIN review_records rr ON rir.record_id = rr.id
    JOIN app_versions av ON rr.version_id = av.id
    LEFT JOIN checklist_version_items cvi ON rir.checklist_version_item_id = cvi.id
    ${whereSql}
    ORDER BY a.submitted_at DESC
    LIMIT @pageSize OFFSET @offset
  `,
    )
    .all({ ...params, pageSize: parseInt(pageSize), offset: parseInt(offset) });

  res.json({
    code: 0,
    data: {
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    },
  });
});

router.get("/:id", (req, res) => {
  const { id } = req.params;

  const appeal = db
    .prepare(
      `
    SELECT a.*, 
           rir.result as item_result,
           rir.comment as item_comment,
           rir.check_item_id,
           rir.checklist_version_item_id,
           cvi.check_item_code,
           cvi.check_item_name,
           cvi.check_item_description,
           cvi.check_item_category,
           rr.id as record_id,
           rr.review_round,
           rr.checklist_version_id,
           av.id as version_id,
           av.app_name,
           av.version_no,
           av.vendor,
           av.category_id,
           cv.version_no as checklist_version_no,
           ct.name as template_name
    FROM appeals a
    JOIN review_item_results rir ON a.review_item_result_id = rir.id
    JOIN review_records rr ON rir.record_id = rr.id
    JOIN app_versions av ON rr.version_id = av.id
    LEFT JOIN checklist_version_items cvi ON rir.checklist_version_item_id = cvi.id
    LEFT JOIN checklist_versions cv ON rr.checklist_version_id = cv.id
    LEFT JOIN checklist_templates ct ON cv.template_id = ct.id
    WHERE a.id = ?
  `,
    )
    .get(id);

  if (!appeal) {
    return res.json({ code: 1, message: "申辩记录不存在" });
  }

  res.json({
    code: 0,
    data: appeal,
  });
});

router.post("/", (req, res) => {
  const { review_item_result_id, vendor_id, vendor_name, content } = req.body;

  if (!review_item_result_id) {
    return res.json({ code: 1, message: "审核项结果ID不能为空" });
  }
  if (!vendor_id || vendor_id.trim() === "") {
    return res.json({ code: 1, message: "厂商ID不能为空" });
  }
  if (!vendor_name || vendor_name.trim() === "") {
    return res.json({ code: 1, message: "厂商名称不能为空" });
  }
  if (!content || content.trim() === "") {
    return res.json({ code: 1, message: "申辩内容不能为空" });
  }

  const itemResult = db
    .prepare(
      `
    SELECT rir.*, rr.version_id, av.status, av.vendor
    FROM review_item_results rir
    JOIN review_records rr ON rir.record_id = rr.id
    JOIN app_versions av ON rr.version_id = av.id
    WHERE rir.id = ?
  `,
    )
    .get(review_item_result_id);

  if (!itemResult) {
    return res.json({ code: 1, message: "审核项结果不存在" });
  }

  if (itemResult.result !== "fail") {
    return res.json({ code: 1, message: "只能对不通过的审核项提出申辩" });
  }

  if (itemResult.status !== "rejected") {
    return res.json({ code: 1, message: "只能在审核驳回状态下提出申辩" });
  }

  if (itemResult.has_appeal) {
    return res.json({ code: 1, message: "该审核项已存在申辩，不能重复提交" });
  }

  try {
    db.transaction(() => {
      const result = db
        .prepare(
          `
        INSERT INTO appeals (review_item_result_id, vendor_id, vendor_name, content)
        VALUES (?, ?, ?, ?)
      `,
        )
        .run(
          review_item_result_id,
          vendor_id.trim(),
          vendor_name.trim(),
          content.trim(),
        );

      db.prepare(
        `
        UPDATE review_item_results 
        SET has_appeal = 1 
        WHERE id = ?
      `,
      ).run(review_item_result_id);

      return result.lastInsertRowid;
    })();

    res.json({
      code: 0,
      message: "申辩提交成功",
    });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

router.post("/review/:id", (req, res) => {
  const { id } = req.params;
  const { review_result, review_comment, reviewer = "系统审核员" } = req.body;

  if (!review_result || !["accepted", "rejected"].includes(review_result)) {
    return res.json({ code: 1, message: "审核结果无效，必须是 accepted 或 rejected" });
  }

  const appeal = db.prepare("SELECT * FROM appeals WHERE id = ?").get(id);
  if (!appeal) {
    return res.json({ code: 1, message: "申辩记录不存在" });
  }

  if (appeal.status !== "pending") {
    return res.json({ code: 1, message: "该申辩已处理，不能重复审核" });
  }

  try {
    db.transaction(() => {
      db.prepare(
        `
        UPDATE appeals 
        SET status = 'reviewed', 
            reviewer = ?, 
            review_result = ?, 
            review_comment = ?, 
            reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      ).run(reviewer, review_result, review_comment || null, id);

      db.prepare(
        `
        UPDATE review_item_results 
        SET appeal_result = ?
        WHERE id = ?
      `,
      ).run(review_result, appeal.review_item_result_id);

      if (review_result === "accepted") {
        const itemResult = db
          .prepare(
            `
          SELECT record_id FROM review_item_results WHERE id = ?
        `,
          )
          .get(appeal.review_item_result_id);

        const allFailItems = db
          .prepare(
            `
          SELECT COUNT(*) as count 
          FROM review_item_results 
          WHERE record_id = ? 
            AND result = 'fail' 
            AND (appeal_result IS NULL OR appeal_result != 'accepted')
        `,
          )
          .get(itemResult.record_id);

        if (allFailItems.count === 0) {
          const record = db
            .prepare(
              `
            SELECT rr.*, av.id as version_id
            FROM review_records rr
            JOIN app_versions av ON rr.version_id = av.id
            WHERE rr.id = ?
          `,
            )
            .get(itemResult.record_id);

          db.prepare(
            `
            UPDATE review_records 
            SET result = 'approved', 
                reject_reason = NULL,
                end_time = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          ).run(itemResult.record_id);

          db.prepare(
            `
            UPDATE app_versions 
            SET status = 'approved', 
                review_end_time = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          ).run(record.version_id);
        }
      }
    })();

    res.json({
      code: 0,
      message:
        review_result === "accepted" ? "已采纳申辩，审核结果更新为通过" : "已维持原判",
    });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

router.get("/by-result/:reviewItemResultId", (req, res) => {
  const { reviewItemResultId } = req.params;

  const appeal = db
    .prepare(
      `
    SELECT a.*, 
           rir.result as item_result,
           rir.comment as item_comment,
           cvi.check_item_name
    FROM appeals a
    JOIN review_item_results rir ON a.review_item_result_id = rir.id
    LEFT JOIN checklist_version_items cvi ON rir.checklist_version_item_id = cvi.id
    WHERE a.review_item_result_id = ?
    ORDER BY a.submitted_at DESC
  `,
    )
    .all(reviewItemResultId);

  res.json({
    code: 0,
    data: appeal,
  });
});

module.exports = router;
