const express = require("express");
const router = express.Router();
const db = require("../db/database");

router.get("/categories", (req, res) => {
  const categories = db
    .prepare(
      `
    SELECT * FROM app_categories 
    WHERE is_active = 1 
    ORDER BY created_at ASC
  `,
    )
    .all();

  res.json({
    code: 0,
    data: categories,
  });
});

router.post("/categories", (req, res) => {
  const { name, description } = req.body;

  if (!name || name.trim() === "") {
    return res.json({ code: 1, message: "类别名称不能为空" });
  }

  try {
    const result = db
      .prepare(
        `
      INSERT INTO app_categories (name, description)
      VALUES (?, ?)
    `,
      )
      .run(name.trim(), description || null);

    res.json({
      code: 0,
      data: { id: result.lastInsertRowid },
      message: "创建成功",
    });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      res.json({ code: 1, message: "类别名称已存在" });
    } else {
      res.json({ code: 1, message: err.message });
    }
  }
});

router.put("/categories/:id", (req, res) => {
  const { id } = req.params;
  const { name, description, is_active } = req.body;

  const category = db
    .prepare("SELECT * FROM app_categories WHERE id = ?")
    .get(id);
  if (!category) {
    return res.json({ code: 1, message: "类别不存在" });
  }

  try {
    db.prepare(
      `
      UPDATE app_categories 
      SET name = COALESCE(?, name), 
          description = COALESCE(?, description),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `,
    ).run(
      name ? name.trim() : null,
      description !== undefined ? description : null,
      is_active !== undefined ? is_active : null,
      id,
    );

    res.json({
      code: 0,
      message: "更新成功",
    });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      res.json({ code: 1, message: "类别名称已存在" });
    } else {
      res.json({ code: 1, message: err.message });
    }
  }
});

router.get("/templates", (req, res) => {
  const { include_items = false } = req.query;

  const templates = db
    .prepare(
      `
    SELECT * FROM checklist_templates 
    WHERE is_active = 1 
    ORDER BY created_at DESC
  `,
    )
    .all();

  if (include_items) {
    for (const template of templates) {
      const items = db
        .prepare(
          `
        SELECT ci.*, tim.sort_order 
        FROM template_item_mapping tim
        JOIN check_items ci ON tim.check_item_id = ci.id
        WHERE tim.template_id = ? AND ci.is_active = 1
        ORDER BY tim.sort_order ASC
      `,
        )
        .all(template.id);
      template.items = items;
    }
  }

  res.json({
    code: 0,
    data: templates,
  });
});

router.post("/templates", (req, res) => {
  const { name, description, item_ids = [] } = req.body;

  if (!name || name.trim() === "") {
    return res.json({ code: 1, message: "模板名称不能为空" });
  }

  try {
    const result = db.transaction(() => {
      const tmplResult = db
        .prepare(
          `
        INSERT INTO checklist_templates (name, description)
        VALUES (?, ?)
      `,
        )
        .run(name.trim(), description || null);

      const templateId = tmplResult.lastInsertRowid;

      if (item_ids && item_ids.length > 0) {
        const insertMapping = db.prepare(`
          INSERT INTO template_item_mapping (template_id, check_item_id, sort_order)
          VALUES (?, ?, ?)
        `);

        item_ids.forEach((itemId, index) => {
          insertMapping.run(templateId, itemId, index + 1);
        });
      }

      return templateId;
    })();

    res.json({
      code: 0,
      data: { id: result },
      message: "创建成功",
    });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      res.json({ code: 1, message: "模板名称已存在" });
    } else {
      res.json({ code: 1, message: err.message });
    }
  }
});

router.put("/templates/:id", (req, res) => {
  const { id } = req.params;
  const { name, description, item_ids, is_active } = req.body;

  const template = db
    .prepare("SELECT * FROM checklist_templates WHERE id = ?")
    .get(id);
  if (!template) {
    return res.json({ code: 1, message: "模板不存在" });
  }

  try {
    db.transaction(() => {
      db.prepare(
        `
        UPDATE checklist_templates 
        SET name = COALESCE(?, name), 
            description = COALESCE(?, description),
            is_active = COALESCE(?, is_active),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      ).run(
        name ? name.trim() : null,
        description !== undefined ? description : null,
        is_active !== undefined ? is_active : null,
        id,
      );

      if (item_ids !== undefined) {
        db.prepare("DELETE FROM template_item_mapping WHERE template_id = ?").run(id);

        if (item_ids.length > 0) {
          const insertMapping = db.prepare(`
            INSERT INTO template_item_mapping (template_id, check_item_id, sort_order)
            VALUES (?, ?, ?)
          `);

          item_ids.forEach((itemId, index) => {
            insertMapping.run(id, itemId, index + 1);
          });
        }
      }
    })();

    res.json({
      code: 0,
      message: "更新成功",
    });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      res.json({ code: 1, message: "模板名称已存在" });
    } else {
      res.json({ code: 1, message: err.message });
    }
  }
});

router.get("/templates/:id/items", (req, res) => {
  const { id } = req.params;

  const items = db
    .prepare(
      `
    SELECT ci.*, tim.sort_order 
    FROM template_item_mapping tim
    JOIN check_items ci ON tim.check_item_id = ci.id
    WHERE tim.template_id = ? AND ci.is_active = 1
    ORDER BY tim.sort_order ASC
  `,
    )
    .all(id);

  res.json({
    code: 0,
    data: items,
  });
});

router.get("/versions", (req, res) => {
  const { template_id } = req.query;

  let whereClause = "";
  let params = {};

  if (template_id) {
    whereClause = "WHERE cv.template_id = @template_id";
    params.template_id = template_id;
  }

  const versions = db
    .prepare(
      `
    SELECT cv.*, ct.name as template_name
    FROM checklist_versions cv
    JOIN checklist_templates ct ON cv.template_id = ct.id
    ${whereClause}
    ORDER BY cv.created_at DESC
  `,
    )
    .all(params);

  res.json({
    code: 0,
    data: versions,
  });
});

router.get("/versions/:id", (req, res) => {
  const { id } = req.params;

  const version = db
    .prepare(
      `
    SELECT cv.*, ct.name as template_name
    FROM checklist_versions cv
    JOIN checklist_templates ct ON cv.template_id = ct.id
    WHERE cv.id = ?
  `,
    )
    .get(id);

  if (!version) {
    return res.json({ code: 1, message: "版本不存在" });
  }

  const items = db
    .prepare(
      `
    SELECT * FROM checklist_version_items 
    WHERE checklist_version_id = ?
    ORDER BY sort_order ASC
  `,
    )
    .all(id);

  version.items = items;

  res.json({
    code: 0,
    data: version,
  });
});

router.post("/versions", (req, res) => {
  const { template_id, version_no, description, created_by = "管理员" } = req.body;

  if (!template_id) {
    return res.json({ code: 1, message: "模板ID不能为空" });
  }
  if (!version_no || version_no.trim() === "") {
    return res.json({ code: 1, message: "版本号不能为空" });
  }

  const template = db
    .prepare("SELECT * FROM checklist_templates WHERE id = ?")
    .get(template_id);
  if (!template) {
    return res.json({ code: 1, message: "模板不存在" });
  }

  try {
    const result = db.transaction(() => {
      const items = db
        .prepare(
          `
        SELECT ci.*, tim.sort_order 
        FROM template_item_mapping tim
        JOIN check_items ci ON tim.check_item_id = ci.id
        WHERE tim.template_id = ? AND ci.is_active = 1
        ORDER BY tim.sort_order ASC
      `,
        )
        .all(template_id);

      if (items.length === 0) {
        throw new Error("模板下没有检查项，无法发布版本");
      }

      const versionResult = db
        .prepare(
          `
        INSERT INTO checklist_versions (template_id, version_no, description, is_locked, created_by)
        VALUES (?, ?, ?, 1, ?)
      `,
        )
        .run(template_id, version_no.trim(), description || null, created_by);

      const versionId = versionResult.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO checklist_version_items (
          checklist_version_id, check_item_id, check_item_code, 
          check_item_name, check_item_description, check_item_category, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(
          versionId,
          item.id,
          item.code,
          item.name,
          item.description,
          item.category,
          item.sort_order,
        );
      }

      return versionId;
    })();

    res.json({
      code: 0,
      data: { id: result },
      message: "版本发布成功",
    });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      res.json({ code: 1, message: "该模板下版本号已存在" });
    } else {
      res.json({ code: 1, message: err.message });
    }
  }
});

router.get("/category-template-mapping", (req, res) => {
  const mappings = db
    .prepare(
      `
    SELECT ctm.*, ac.name as category_name, ct.name as template_name
    FROM category_template_mapping ctm
    JOIN app_categories ac ON ctm.category_id = ac.id
    JOIN checklist_templates ct ON ctm.template_id = ct.id
    ORDER BY ac.name ASC
  `,
    )
    .all();

  res.json({
    code: 0,
    data: mappings,
  });
});

router.post("/category-template-mapping", (req, res) => {
  const { category_id, template_id } = req.body;

  if (!category_id || !template_id) {
    return res.json({ code: 1, message: "类别ID和模板ID都不能为空" });
  }

  try {
    const result = db
      .prepare(
        `
      INSERT INTO category_template_mapping (category_id, template_id)
      VALUES (?, ?)
    `,
      )
      .run(category_id, template_id);

    res.json({
      code: 0,
      data: { id: result.lastInsertRowid },
      message: "映射成功",
    });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      res.json({ code: 1, message: "该映射已存在" });
    } else {
      res.json({ code: 1, message: err.message });
    }
  }
});

router.delete("/category-template-mapping/:id", (req, res) => {
  const { id } = req.params;

  db.prepare("DELETE FROM category_template_mapping WHERE id = ?").run(id);

  res.json({
    code: 0,
    message: "删除成功",
  });
});

router.get("/check-items", (req, res) => {
  const { active_only = true } = req.query;

  let whereClause = "";
  if (active_only === "true") {
    whereClause = "WHERE is_active = 1";
  }

  const items = db
    .prepare(
      `
    SELECT * FROM check_items 
    ${whereClause}
    ORDER BY sort_order ASC, id ASC
  `,
    )
    .all();

  res.json({
    code: 0,
    data: items,
  });
});

router.post("/check-items", (req, res) => {
  const { code, name, description, category, sort_order } = req.body;

  if (!code || code.trim() === "") {
    return res.json({ code: 1, message: "检查项编码不能为空" });
  }
  if (!name || name.trim() === "") {
    return res.json({ code: 1, message: "检查项名称不能为空" });
  }
  if (!category || category.trim() === "") {
    return res.json({ code: 1, message: "检查项分类不能为空" });
  }

  try {
    const result = db
      .prepare(
        `
      INSERT INTO check_items (code, name, description, category, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(
        code.trim(),
        name.trim(),
        description || null,
        category.trim(),
        sort_order || 0,
      );

    res.json({
      code: 0,
      data: { id: result.lastInsertRowid },
      message: "创建成功",
    });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      res.json({ code: 1, message: "检查项编码已存在" });
    } else {
      res.json({ code: 1, message: err.message });
    }
  }
});

router.put("/check-items/:id", (req, res) => {
  const { id } = req.params;
  const { name, description, category, sort_order, is_active } = req.body;

  const item = db.prepare("SELECT * FROM check_items WHERE id = ?").get(id);
  if (!item) {
    return res.json({ code: 1, message: "检查项不存在" });
  }

  db.prepare(
    `
    UPDATE check_items 
    SET name = COALESCE(?, name), 
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
  ).run(
    name ? name.trim() : null,
    description !== undefined ? description : null,
    category ? category.trim() : null,
    sort_order !== undefined ? sort_order : null,
    is_active !== undefined ? is_active : null,
    id,
  );

  res.json({
    code: 0,
    message: "更新成功",
  });
});

module.exports = router;
