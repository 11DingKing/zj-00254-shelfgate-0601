const express = require("express");
const router = express.Router();
const db = require("../db/database");

router.get("/check-items", (req, res) => {
  const { version_id } = req.query;

  if (version_id) {
    const version = db
      .prepare("SELECT * FROM app_versions WHERE id = ?")
      .get(version_id);
    if (!version) {
      return res.json({ code: 1, message: "版本不存在" });
    }

    const activeRecord = db
      .prepare(
        `
      SELECT rr.checklist_version_id 
      FROM review_records rr
      WHERE rr.version_id = ? AND rr.end_time IS NULL
      ORDER BY rr.review_round DESC LIMIT 1
    `,
      )
      .get(version_id);

    if (activeRecord && activeRecord.checklist_version_id) {
      const items = db
        .prepare(
          `
        SELECT cvi.* 
        FROM checklist_version_items cvi
        WHERE cvi.checklist_version_id = ?
        ORDER BY cvi.sort_order ASC
      `,
        )
        .all(activeRecord.checklist_version_id);

      return res.json({
        code: 0,
        data: items.map((item) => ({
          id: item.check_item_id,
          code: item.check_item_code,
          name: item.check_item_name,
          description: item.check_item_description,
          category: item.check_item_category,
          sort_order: item.sort_order,
          checklist_version_item_id: item.id,
        })),
      });
    }

    if (version.category_id) {
      const latestVersion = db
        .prepare(
          `
        SELECT cv.id 
        FROM category_template_mapping ctm
        JOIN checklist_versions cv ON ctm.template_id = cv.template_id
        WHERE ctm.category_id = ? AND cv.is_locked = 1
        ORDER BY cv.created_at DESC
        LIMIT 1
      `,
        )
        .get(version.category_id);

      if (latestVersion) {
        const items = db
          .prepare(
            `
          SELECT cvi.* 
          FROM checklist_version_items cvi
          WHERE cvi.checklist_version_id = ?
          ORDER BY cvi.sort_order ASC
        `,
          )
          .all(latestVersion.id);

        return res.json({
          code: 0,
          data: items.map((item) => ({
            id: item.check_item_id,
            code: item.check_item_code,
            name: item.check_item_name,
            description: item.check_item_description,
            category: item.check_item_category,
            sort_order: item.sort_order,
            checklist_version_item_id: item.id,
          })),
        });
      }
    }
  }

  const items = db
    .prepare(
      `
    SELECT * FROM check_items WHERE is_active = 1 ORDER BY sort_order ASC, id ASC
  `,
    )
    .all();

  res.json({
    code: 0,
    data: items,
  });
});

router.get("/checklist-version/:versionId", (req, res) => {
  const { versionId } = req.params;

  const record = db
    .prepare(
      `
    SELECT rr.checklist_version_id 
    FROM review_records rr
    WHERE rr.version_id = ?
    ORDER BY rr.review_round DESC
    LIMIT 1
  `,
    )
    .get(versionId);

  if (!record || !record.checklist_version_id) {
    return res.json({ code: 1, message: "该版本暂无审核清单版本信息" });
  }

  const version = db
    .prepare(
      `
    SELECT cv.*, ct.name as template_name
    FROM checklist_versions cv
    JOIN checklist_templates ct ON cv.template_id = ct.id
    WHERE cv.id = ?
  `,
    )
    .get(record.checklist_version_id);

  const items = db
    .prepare(
      `
    SELECT * FROM checklist_version_items 
    WHERE checklist_version_id = ?
    ORDER BY sort_order ASC
  `,
    )
    .all(record.checklist_version_id);

  version.items = items;

  res.json({
    code: 0,
    data: version,
  });
});

router.post("/start/:versionId", (req, res) => {
  const versionId = req.params.versionId;
  const { reviewer = "系统审核员" } = req.body;

  const version = db
    .prepare("SELECT * FROM app_versions WHERE id = ?")
    .get(versionId);
  if (!version) {
    return res.json({ code: 1, message: "版本不存在" });
  }

  if (version.status !== "pending") {
    return res.json({
      code: 1,
      message: "当前状态不允许开始审核，请先由厂商重新提交",
    });
  }

  const activeRecord = db
    .prepare(
      `
    SELECT * FROM review_records 
    WHERE version_id = ? AND end_time IS NULL
    ORDER BY review_round DESC LIMIT 1
  `,
    )
    .get(versionId);
  if (activeRecord) {
    return res.json({
      code: 1,
      message: "存在未完成的审核记录，请先完成当前审核",
    });
  }

  const currentRound = version.reject_count + 1;

  const lastRecord = db
    .prepare(
      `
    SELECT * FROM review_records 
    WHERE version_id = ?
    ORDER BY review_round DESC LIMIT 1
  `,
    )
    .get(versionId);
  if (lastRecord && lastRecord.review_round >= currentRound) {
    return res.json({
      code: 1,
      message: "审核轮次异常，请先由厂商重新提交",
    });
  }

  let checklistVersionId = null;
  if (version.category_id) {
    const latestVersion = db
      .prepare(
        `
      SELECT cv.id 
      FROM category_template_mapping ctm
      JOIN checklist_versions cv ON ctm.template_id = cv.template_id
      WHERE ctm.category_id = ? AND cv.is_locked = 1
      ORDER BY cv.created_at DESC
      LIMIT 1
    `,
      )
      .get(version.category_id);

    if (latestVersion) {
      checklistVersionId = latestVersion.id;
    }
  }

  const result = db.transaction(() => {
    db.prepare(
      `
      UPDATE app_versions 
      SET status = 'reviewing', review_start_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    ).run(versionId);

    const record = db
      .prepare(
        `
      INSERT INTO review_records (version_id, review_round, reviewer, checklist_version_id, start_time)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
      )
      .run(versionId, currentRound, reviewer, checklistVersionId);

    return { recordId: record.lastInsertRowid, checklistVersionId };
  })();

  res.json({
    code: 0,
    data: result,
    message: checklistVersionId ? "开始审核，已绑定清单版本" : "开始审核",
  });
});

router.post("/submit/:versionId", (req, res) => {
  const versionId = req.params.versionId;
  const { results, rejectReason, reviewer = "系统审核员" } = req.body;

  const version = db
    .prepare("SELECT * FROM app_versions WHERE id = ?")
    .get(versionId);
  if (!version) {
    return res.json({ code: 1, message: "版本不存在" });
  }

  if (version.status !== "reviewing") {
    return res.json({ code: 1, message: "当前状态不允许提交审核结果" });
  }

  if (!results || !Array.isArray(results) || results.length === 0) {
    return res.json({ code: 1, message: "请填写审核项结果" });
  }

  const currentRecord = db
    .prepare(
      `
    SELECT * FROM review_records 
    WHERE version_id = ? 
    ORDER BY review_round DESC LIMIT 1
  `,
    )
    .get(versionId);

  if (!currentRecord) {
    return res.json({ code: 1, message: "审核记录不存在" });
  }

  if (currentRecord.end_time) {
    return res.json({ code: 1, message: "当前审核已完成，不能重复提交" });
  }

  const expectedRound = version.reject_count + 1;
  if (currentRecord.review_round !== expectedRound) {
    return res.json({
      code: 1,
      message: "审核轮次不匹配，请重新开始审核",
    });
  }

  let allCheckItems = [];
  let allItemIds = [];
  let totalCheckItems = 0;

  if (currentRecord.checklist_version_id) {
    allCheckItems = db
      .prepare(
        `
      SELECT id, check_item_id FROM checklist_version_items 
      WHERE checklist_version_id = ? 
      ORDER BY sort_order ASC
    `,
      )
      .all(currentRecord.checklist_version_id);
    allItemIds = allCheckItems.map((item) => item.check_item_id);
    totalCheckItems = allCheckItems.length;
  } else {
    allCheckItems = db
      .prepare("SELECT id FROM check_items WHERE is_active = 1 ORDER BY id ASC")
      .all();
    allItemIds = allCheckItems.map((item) => item.id);
    totalCheckItems = allCheckItems.length;
  }

  const submittedItemIds = results
    .map((r) => {
      const id = parseInt(r.check_item_id);
      return isNaN(id) ? null : id;
    })
    .filter((id) => id !== null);
  const uniqueItemIds = [...new Set(submittedItemIds)];

  const missingIds = allItemIds.filter((id) => !uniqueItemIds.includes(id));
  if (missingIds.length > 0) {
    return res.json({
      code: 1,
      message: `请完成所有 ${totalCheckItems} 项检查，还有 ${missingIds.length} 项未审核`,
    });
  }

  const validResults = ["pass", "fail"];
  const hasInvalidResult = results.some(
    (r) => !validResults.includes(r.result),
  );
  if (hasInvalidResult) {
    return res.json({ code: 1, message: "存在无效的审核结果值" });
  }

  const invalidIds = uniqueItemIds.filter((id) => !allItemIds.includes(id));
  if (invalidIds.length > 0) {
    return res.json({ code: 1, message: "存在无效的检查项ID" });
  }

  const hasFail = results.some((r) => r.result === "fail");
  const finalResult = hasFail ? "rejected" : "approved";

  const versionItemMap = {};
  if (currentRecord.checklist_version_id) {
    const versionItems = db
      .prepare(
        `
      SELECT id, check_item_id FROM checklist_version_items 
      WHERE checklist_version_id = ?
    `,
      )
      .all(currentRecord.checklist_version_id);
    for (const vi of versionItems) {
      versionItemMap[vi.check_item_id] = vi.id;
    }
  }

  db.transaction(() => {
    const insertItem = db.prepare(`
      INSERT INTO review_item_results (record_id, check_item_id, checklist_version_item_id, result, comment)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of results) {
      const versionItemId = versionItemMap[item.check_item_id] || null;
      insertItem.run(
        currentRecord.id,
        item.check_item_id,
        versionItemId,
        item.result,
        item.comment || null,
      );
    }

    db.prepare(
      `
      UPDATE review_records 
      SET end_time = CURRENT_TIMESTAMP, result = ?, reject_reason = ?
      WHERE id = ?
    `,
    ).run(
      finalResult,
      finalResult === "rejected" ? rejectReason : null,
      currentRecord.id,
    );

    if (finalResult === "rejected") {
      db.prepare(
        `
        UPDATE app_versions 
        SET status = 'rejected', review_end_time = CURRENT_TIMESTAMP, reject_count = reject_count + 1
        WHERE id = ?
      `,
      ).run(versionId);
    } else {
      db.prepare(
        `
        UPDATE app_versions 
        SET status = 'approved', review_end_time = CURRENT_TIMESTAMP, shelf_status = 'normal'
        WHERE id = ?
      `,
      ).run(versionId);
    }
  })();

  res.json({
    code: 0,
    message: finalResult === "rejected" ? "审核驳回" : "审核通过",
  });
});

router.post("/off-shelf/:versionId", (req, res) => {
  const versionId = req.params.versionId;
  const { reason } = req.body;

  const version = db
    .prepare("SELECT * FROM app_versions WHERE id = ?")
    .get(versionId);
  if (!version) {
    return res.json({ code: 1, message: "版本不存在" });
  }

  if (version.status !== "approved") {
    return res.json({ code: 1, message: "只有已通过的版本才能下架" });
  }

  if (version.shelf_status === "off_shelf") {
    return res.json({ code: 1, message: "该版本已下架" });
  }

  if (!reason || reason.trim() === "") {
    return res.json({ code: 1, message: "请填写下架理由" });
  }

  db.prepare(
    `
    UPDATE app_versions 
    SET shelf_status = 'off_shelf', shelf_off_reason = ?, shelf_off_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
  ).run(reason, versionId);

  res.json({
    code: 0,
    message: "已强制下架",
  });
});

router.post("/re-submit/:versionId", (req, res) => {
  const versionId = req.params.versionId;

  const version = db
    .prepare("SELECT * FROM app_versions WHERE id = ?")
    .get(versionId);
  if (!version) {
    return res.json({ code: 1, message: "版本不存在" });
  }

  if (version.status !== "rejected") {
    return res.json({ code: 1, message: "只有驳回状态的版本才能重新提交" });
  }

  db.prepare(
    `
    UPDATE app_versions 
    SET status = 'pending', submit_time = CURRENT_TIMESTAMP, review_start_time = NULL, review_end_time = NULL
    WHERE id = ?
  `,
  ).run(versionId);

  res.json({
    code: 0,
    message: "已重新提交",
  });
});

module.exports = router;
