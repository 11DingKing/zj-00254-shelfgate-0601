const db = require("./database");

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS check_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS checklist_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS category_template_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      template_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES app_categories(id),
      FOREIGN KEY (template_id) REFERENCES checklist_templates(id),
      UNIQUE(category_id, template_id)
    );

    CREATE TABLE IF NOT EXISTS template_item_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      check_item_id INTEGER NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES checklist_templates(id),
      FOREIGN KEY (check_item_id) REFERENCES check_items(id),
      UNIQUE(template_id, check_item_id)
    );

    CREATE TABLE IF NOT EXISTS checklist_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      version_no TEXT NOT NULL,
      description TEXT,
      is_locked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT '系统',
      FOREIGN KEY (template_id) REFERENCES checklist_templates(id),
      UNIQUE(template_id, version_no)
    );

    CREATE TABLE IF NOT EXISTS checklist_version_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_version_id INTEGER NOT NULL,
      check_item_id INTEGER NOT NULL,
      check_item_code TEXT NOT NULL,
      check_item_name TEXT NOT NULL,
      check_item_description TEXT,
      check_item_category TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (checklist_version_id) REFERENCES checklist_versions(id),
      UNIQUE(checklist_version_id, check_item_id)
    );

    CREATE TABLE IF NOT EXISTS app_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT NOT NULL,
      version_no TEXT NOT NULL,
      vendor TEXT NOT NULL,
      category_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      submit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      review_start_time DATETIME,
      review_end_time DATETIME,
      reject_count INTEGER DEFAULT 0,
      shelf_status TEXT DEFAULT 'normal',
      shelf_off_reason TEXT,
      shelf_off_time DATETIME,
      FOREIGN KEY (category_id) REFERENCES app_categories(id),
      UNIQUE(app_name, version_no, vendor)
    );

    CREATE TABLE IF NOT EXISTS review_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      review_round INTEGER NOT NULL,
      reviewer TEXT DEFAULT '系统审核员',
      checklist_version_id INTEGER,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      result TEXT,
      reject_reason TEXT,
      FOREIGN KEY (version_id) REFERENCES app_versions(id),
      FOREIGN KEY (checklist_version_id) REFERENCES checklist_versions(id)
    );

    CREATE TABLE IF NOT EXISTS review_item_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      check_item_id INTEGER NOT NULL,
      checklist_version_item_id INTEGER,
      result TEXT NOT NULL,
      comment TEXT,
      has_appeal INTEGER DEFAULT 0,
      appeal_result TEXT,
      FOREIGN KEY (record_id) REFERENCES review_records(id),
      FOREIGN KEY (check_item_id) REFERENCES check_items(id),
      FOREIGN KEY (checklist_version_item_id) REFERENCES checklist_version_items(id),
      UNIQUE(record_id, check_item_id)
    );

    CREATE TABLE IF NOT EXISTS appeals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_item_result_id INTEGER NOT NULL,
      vendor_id TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      content TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer TEXT,
      review_result TEXT,
      review_comment TEXT,
      reviewed_at DATETIME,
      FOREIGN KEY (review_item_result_id) REFERENCES review_item_results(id)
    );
  `);
}

const checkItemsData = [
  {
    code: "splash_close_visible",
    name: "开屏关闭按钮清晰可见",
    description: "开屏广告的关闭按钮必须清晰可见，不能与背景融为一体",
    category: "开屏广告",
    sort_order: 1,
  },
  {
    code: "splash_close_area",
    name: "关闭热区大小合规",
    description: "关闭按钮热区不能过小，必须保证用户容易点击",
    category: "开屏广告",
    sort_order: 2,
  },
  {
    code: "fullscreen_click_jump",
    name: "无全屏可点跳转",
    description: "不能整个页面都是可点击跳转区域，容易造成误触",
    category: "开屏广告",
    sort_order: 3,
  },
  {
    code: "shake_trigger",
    name: "无摇一摇误触",
    description: "不能使用摇一摇等容易误触的方式触发跳转",
    category: "交互行为",
    sort_order: 4,
  },
  {
    code: "jump_notification",
    name: "跳转前明确告知",
    description: "跳转到第三方应用或网页前必须明确告知用户",
    category: "跳转行为",
    sort_order: 5,
  },
  {
    code: "auto_redirect",
    name: "无自动跳转",
    description: "不能未经用户同意自动跳转到其他页面或应用",
    category: "跳转行为",
    sort_order: 6,
  },
  {
    code: "fake_close_button",
    name: "无虚假关闭按钮",
    description: "不能有虚假的关闭按钮，点击后反而跳转",
    category: "开屏广告",
    sort_order: 7,
  },
  {
    code: "countdown_display",
    name: "倒计时清晰展示",
    description: "开屏广告的倒计时必须清晰可见，让用户知道等待时间",
    category: "开屏广告",
    sort_order: 8,
  },
];

function initCheckItems() {
  const count = db
    .prepare("SELECT COUNT(*) as count FROM check_items")
    .get().count;
  if (count > 0) return;

  const stmt = db.prepare(`
    INSERT INTO check_items (code, name, description, category, sort_order)
    VALUES (@code, @name, @description, @category, @sort_order)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      stmt.run(item);
    }
  });

  insertMany(checkItemsData);
}

function initCategoriesAndTemplates() {
  const categoryCount = db
    .prepare("SELECT COUNT(*) as count FROM app_categories")
    .get().count;
  if (categoryCount > 0) return;

  db.transaction(() => {
    const insertCategory = db.prepare(`
      INSERT INTO app_categories (name, description)
      VALUES (?, ?)
    `);

    const insertTemplate = db.prepare(`
      INSERT INTO checklist_templates (name, description)
      VALUES (?, ?)
    `);

    const insertMapping = db.prepare(`
      INSERT INTO category_template_mapping (category_id, template_id)
      VALUES (?, ?)
    `);

    const insertItemMapping = db.prepare(`
      INSERT INTO template_item_mapping (template_id, check_item_id, sort_order)
      VALUES (?, ?, ?)
    `);

    const catGame = insertCategory.run(
      "游戏类",
      "游戏类应用，包括休闲游戏、网络游戏等",
    );
    const catVideo = insertCategory.run("视频类", "视频播放、直播类应用");
    const catNews = insertCategory.run("资讯类", "新闻资讯、内容聚合类应用");
    const catHealth = insertCategory.run("健康类", "健康运动、医疗健康类应用");
    const catShopping = insertCategory.run("电商类", "购物、电商类应用");

    const tmplGeneral = insertTemplate.run(
      "通用合规清单",
      "适用于大多数应用的通用合规检查清单",
    );
    const tmplGame = insertTemplate.run(
      "游戏专项清单",
      "游戏类应用专项检查清单，包含更严格的广告和交互规范",
    );
    const tmplVideo = insertTemplate.run(
      "视频专项清单",
      "视频类应用专项检查清单",
    );

    insertMapping.run(catGame.lastInsertRowid, tmplGame.lastInsertRowid);
    insertMapping.run(catVideo.lastInsertRowid, tmplVideo.lastInsertRowid);
    insertMapping.run(catNews.lastInsertRowid, tmplGeneral.lastInsertRowid);
    insertMapping.run(catHealth.lastInsertRowid, tmplGeneral.lastInsertRowid);
    insertMapping.run(catShopping.lastInsertRowid, tmplGeneral.lastInsertRowid);

    const allItems = db
      .prepare("SELECT id FROM check_items ORDER BY sort_order ASC")
      .all();
    for (let i = 0; i < allItems.length; i++) {
      insertItemMapping.run(tmplGeneral.lastInsertRowid, allItems[i].id, i + 1);
      insertItemMapping.run(tmplGame.lastInsertRowid, allItems[i].id, i + 1);
      insertItemMapping.run(tmplVideo.lastInsertRowid, allItems[i].id, i + 1);
    }
  })();
}

function initChecklistVersions() {
  const versionCount = db
    .prepare("SELECT COUNT(*) as count FROM checklist_versions")
    .get().count;
  if (versionCount > 0) return;

  db.transaction(() => {
    const templates = db.prepare("SELECT * FROM checklist_templates").all();

    for (const template of templates) {
      const items = db
        .prepare(
          `
        SELECT ci.*, tim.sort_order 
        FROM template_item_mapping tim
        JOIN check_items ci ON tim.check_item_id = ci.id
        WHERE tim.template_id = ?
        ORDER BY tim.sort_order ASC
      `,
        )
        .all(template.id);

      const insertVersion = db.prepare(`
        INSERT INTO checklist_versions (template_id, version_no, description, is_locked, created_by)
        VALUES (?, ?, ?, 1, '系统初始化')
      `);

      const versionResult = insertVersion.run(template.id, "1.0.0", "初始版本");
      const versionId = versionResult.lastInsertRowid;

      const insertVersionItem = db.prepare(`
        INSERT INTO checklist_version_items (
          checklist_version_id, check_item_id, check_item_code, 
          check_item_name, check_item_description, check_item_category, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertVersionItem.run(
          versionId,
          item.id,
          item.code,
          item.name,
          item.description,
          item.category,
          item.sort_order,
        );
      }
    }
  })();
}

function initSeedData() {
  const count = db
    .prepare("SELECT COUNT(*) as count FROM app_versions")
    .get().count;
  if (count > 0) return;

  const insertVersion = db.prepare(`
    INSERT INTO app_versions (app_name, version_no, vendor, category_id, status, submit_time, review_start_time, review_end_time, reject_count, shelf_status)
    VALUES (@app_name, @version_no, @vendor, @category_id, @status, @submit_time, @review_start_time, @review_end_time, @reject_count, @shelf_status)
  `);

  const insertRecord = db.prepare(`
    INSERT INTO review_records (version_id, review_round, reviewer, checklist_version_id, start_time, end_time, result, reject_reason)
    VALUES (@version_id, @review_round, @reviewer, @checklist_version_id, @start_time, @end_time, @result, @reject_reason)
  `);

  const insertItemResult = db.prepare(`
    INSERT INTO review_item_results (record_id, check_item_id, result, comment)
    VALUES (@record_id, @check_item_id, @result, @comment)
  `);

  const now = Date.now();
  const hour = 3600 * 1000;

  const categories = db.prepare("SELECT id, name FROM app_categories").all();
  const catMap = {};
  for (const c of categories) {
    catMap[c.name] = c.id;
  }

  const getLatestVersionId = (templateName) => {
    const row = db
      .prepare(
        `
      SELECT cv.id FROM checklist_versions cv
      JOIN checklist_templates ct ON cv.template_id = ct.id
      WHERE ct.name = ?
      ORDER BY cv.created_at DESC
      LIMIT 1
    `,
      )
      .get(templateName);
    return row ? row.id : null;
  };

  const gameTmplVersionId = getLatestVersionId("游戏专项清单");
  const videoTmplVersionId = getLatestVersionId("视频专项清单");
  const generalTmplVersionId = getLatestVersionId("通用合规清单");

  const seedData = db.transaction(() => {
    const v1 = insertVersion.run({
      app_name: "欢乐消消乐",
      version_no: "2.3.0",
      vendor: "星辰游戏",
      category_id: catMap["游戏类"],
      status: "pending",
      submit_time: new Date(now - 2 * hour).toISOString(),
      review_start_time: null,
      review_end_time: null,
      reject_count: 0,
      shelf_status: "normal",
    });

    const v2 = insertVersion.run({
      app_name: "趣看视频",
      version_no: "5.1.2",
      vendor: "快影科技",
      category_id: catMap["视频类"],
      status: "reviewing",
      submit_time: new Date(now - 5 * hour).toISOString(),
      review_start_time: new Date(now - 1 * hour).toISOString(),
      review_end_time: null,
      reject_count: 1,
      shelf_status: "normal",
    });

    const v2Record = insertRecord.run({
      version_id: v2.lastInsertRowid,
      review_round: 1,
      reviewer: "张审核",
      checklist_version_id: videoTmplVersionId,
      start_time: new Date(now - 4 * hour).toISOString(),
      end_time: new Date(now - 3.5 * hour).toISOString(),
      result: "rejected",
      reject_reason: "开屏广告关闭按钮不清晰，且存在摇一摇误触跳转问题",
    });

    insertItemResult.run({
      record_id: v2Record.lastInsertRowid,
      check_item_id: 1,
      result: "fail",
      comment: "关闭按钮与背景颜色相近，难以辨识",
    });
    insertItemResult.run({
      record_id: v2Record.lastInsertRowid,
      check_item_id: 2,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v2Record.lastInsertRowid,
      check_item_id: 3,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v2Record.lastInsertRowid,
      check_item_id: 4,
      result: "fail",
      comment: "摇一摇触发跳转，灵敏度过高易误触",
    });
    insertItemResult.run({
      record_id: v2Record.lastInsertRowid,
      check_item_id: 5,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v2Record.lastInsertRowid,
      check_item_id: 6,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v2Record.lastInsertRowid,
      check_item_id: 7,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v2Record.lastInsertRowid,
      check_item_id: 8,
      result: "pass",
      comment: null,
    });

    insertRecord.run({
      version_id: v2.lastInsertRowid,
      review_round: 2,
      reviewer: "张审核",
      checklist_version_id: videoTmplVersionId,
      start_time: new Date(now - 1 * hour).toISOString(),
      end_time: null,
      result: null,
      reject_reason: null,
    });

    const v3 = insertVersion.run({
      app_name: "每日头条",
      version_no: "3.8.1",
      vendor: "字节互动",
      category_id: catMap["资讯类"],
      status: "rejected",
      submit_time: new Date(now - 24 * hour).toISOString(),
      review_start_time: new Date(now - 20 * hour).toISOString(),
      review_end_time: new Date(now - 18 * hour).toISOString(),
      reject_count: 2,
      shelf_status: "normal",
    });

    const v3Record1 = insertRecord.run({
      version_id: v3.lastInsertRowid,
      review_round: 1,
      reviewer: "李审核",
      checklist_version_id: generalTmplVersionId,
      start_time: new Date(now - 22 * hour).toISOString(),
      end_time: new Date(now - 21 * hour).toISOString(),
      result: "rejected",
      reject_reason: "存在全屏点击跳转问题",
    });
    insertItemResult.run({
      record_id: v3Record1.lastInsertRowid,
      check_item_id: 1,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v3Record1.lastInsertRowid,
      check_item_id: 2,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v3Record1.lastInsertRowid,
      check_item_id: 3,
      result: "fail",
      comment: "整个开屏页面都可点击跳转，误触率高",
    });
    insertItemResult.run({
      record_id: v3Record1.lastInsertRowid,
      check_item_id: 4,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v3Record1.lastInsertRowid,
      check_item_id: 5,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v3Record1.lastInsertRowid,
      check_item_id: 6,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v3Record1.lastInsertRowid,
      check_item_id: 7,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v3Record1.lastInsertRowid,
      check_item_id: 8,
      result: "pass",
      comment: null,
    });

    const v3Record2 = insertRecord.run({
      version_id: v3.lastInsertRowid,
      review_round: 2,
      reviewer: "王审核",
      checklist_version_id: generalTmplVersionId,
      start_time: new Date(now - 20 * hour).toISOString(),
      end_time: new Date(now - 18 * hour).toISOString(),
      result: "rejected",
      reject_reason: "全屏点击问题未修复，新增虚假关闭按钮问题",
    });
    insertItemResult.run({
      record_id: v3Record2.lastInsertRowid,
      check_item_id: 1,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v3Record2.lastInsertRowid,
      check_item_id: 2,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v3Record2.lastInsertRowid,
      check_item_id: 3,
      result: "fail",
      comment: "虽然加了关闭按钮，但整个页面依然可点击跳转",
    });
    insertItemResult.run({
      record_id: v3Record2.lastInsertRowid,
      check_item_id: 4,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v3Record2.lastInsertRowid,
      check_item_id: 5,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v3Record2.lastInsertRowid,
      check_item_id: 6,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v3Record2.lastInsertRowid,
      check_item_id: 7,
      result: "fail",
      comment: '右上角"×"按钮点击后不是关闭而是跳转',
    });
    insertItemResult.run({
      record_id: v3Record2.lastInsertRowid,
      check_item_id: 8,
      result: "pass",
      comment: null,
    });

    const v4 = insertVersion.run({
      app_name: "健康步数宝",
      version_no: "1.2.5",
      vendor: "悦动科技",
      category_id: catMap["健康类"],
      status: "approved",
      submit_time: new Date(now - 48 * hour).toISOString(),
      review_start_time: new Date(now - 40 * hour).toISOString(),
      review_end_time: new Date(now - 38 * hour).toISOString(),
      reject_count: 0,
      shelf_status: "normal",
    });
    const v4Record = insertRecord.run({
      version_id: v4.lastInsertRowid,
      review_round: 1,
      reviewer: "赵审核",
      checklist_version_id: generalTmplVersionId,
      start_time: new Date(now - 40 * hour).toISOString(),
      end_time: new Date(now - 38 * hour).toISOString(),
      result: "approved",
      reject_reason: null,
    });
    for (let i = 1; i <= 8; i++) {
      insertItemResult.run({
        record_id: v4Record.lastInsertRowid,
        check_item_id: i,
        result: "pass",
        comment: null,
      });
    }

    const v5 = insertVersion.run({
      app_name: "趣购优选",
      version_no: "4.0.0",
      vendor: "快影科技",
      category_id: catMap["电商类"],
      status: "approved",
      submit_time: new Date(now - 72 * hour).toISOString(),
      review_start_time: new Date(now - 65 * hour).toISOString(),
      review_end_time: new Date(now - 60 * hour).toISOString(),
      reject_count: 1,
      shelf_status: "off_shelf",
    });
    const v5Record1 = insertRecord.run({
      version_id: v5.lastInsertRowid,
      review_round: 1,
      reviewer: "李审核",
      checklist_version_id: generalTmplVersionId,
      start_time: new Date(now - 70 * hour).toISOString(),
      end_time: new Date(now - 68 * hour).toISOString(),
      result: "rejected",
      reject_reason: "跳转前未明确告知用户",
    });
    insertItemResult.run({
      record_id: v5Record1.lastInsertRowid,
      check_item_id: 1,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v5Record1.lastInsertRowid,
      check_item_id: 2,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v5Record1.lastInsertRowid,
      check_item_id: 3,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v5Record1.lastInsertRowid,
      check_item_id: 4,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v5Record1.lastInsertRowid,
      check_item_id: 5,
      result: "fail",
      comment: "点击广告直接跳转，没有二次确认提示",
    });
    insertItemResult.run({
      record_id: v5Record1.lastInsertRowid,
      check_item_id: 6,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v5Record1.lastInsertRowid,
      check_item_id: 7,
      result: "pass",
      comment: null,
    });
    insertItemResult.run({
      record_id: v5Record1.lastInsertRowid,
      check_item_id: 8,
      result: "pass",
      comment: null,
    });

    const v5Record2 = insertRecord.run({
      version_id: v5.lastInsertRowid,
      review_round: 2,
      reviewer: "张审核",
      checklist_version_id: generalTmplVersionId,
      start_time: new Date(now - 65 * hour).toISOString(),
      end_time: new Date(now - 60 * hour).toISOString(),
      result: "approved",
      reject_reason: null,
    });
    for (let i = 1; i <= 8; i++) {
      insertItemResult.run({
        record_id: v5Record2.lastInsertRowid,
        check_item_id: i,
        result: "pass",
        comment: null,
      });
    }

    db.prepare(
      `
      UPDATE app_versions 
      SET shelf_off_reason = ?, shelf_off_time = ?
      WHERE id = ?
    `,
    ).run(
      "接到用户举报，存在诱导点击跳转行为，经核实后强制下架",
      new Date(now - 10 * hour).toISOString(),
      v5.lastInsertRowid,
    );
  });

  seedData();
}

function fixDataConsistency() {
  const versions = db
    .prepare("SELECT id FROM app_versions ORDER BY id ASC")
    .all();

  const updateRejectCount = db.prepare(`
    UPDATE app_versions SET reject_count = ? WHERE id = ?
  `);

  const updateStatus = db.prepare(`
    UPDATE app_versions SET status = ? WHERE id = ?
  `);

  let fixedRejectCount = 0;
  let fixedStatus = 0;

  for (const v of versions) {
    const actualRejects = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM review_records 
      WHERE version_id = ? AND result = 'rejected'
    `,
      )
      .get(v.id).count;

    const current = db
      .prepare("SELECT reject_count, status FROM app_versions WHERE id = ?")
      .get(v.id);

    if (current.reject_count !== actualRejects) {
      updateRejectCount.run(actualRejects, v.id);
      fixedRejectCount++;
    }

    const activeReview = db
      .prepare(
        `
      SELECT id FROM review_records 
      WHERE version_id = ? AND (end_time IS NULL OR result IS NULL)
      ORDER BY review_round DESC LIMIT 1
    `,
      )
      .get(v.id);

    let expectedStatus = current.status;

    if (activeReview) {
      expectedStatus = "reviewing";
    } else {
      const latestResult = db
        .prepare(
          `
        SELECT result FROM review_records 
        WHERE version_id = ? AND result IS NOT NULL
        ORDER BY review_round DESC LIMIT 1
      `,
        )
        .get(v.id);

      if (!latestResult) {
        expectedStatus = "pending";
      } else if (latestResult.result === "approved") {
        expectedStatus = "approved";
      } else if (latestResult.result === "rejected") {
        expectedStatus = "rejected";
      }
    }

    if (current.status !== expectedStatus) {
      updateStatus.run(expectedStatus, v.id);
      fixedStatus++;
    }
  }

  if (fixedRejectCount > 0 || fixedStatus > 0) {
    console.log(
      `数据一致性修复完成：修复 ${fixedRejectCount} 条版本驳回次数，修复 ${fixedStatus} 条版本状态`,
    );
  }
}

function initAll() {
  initSchema();
  initCheckItems();
  initCategoriesAndTemplates();
  initChecklistVersions();
  initSeedData();
  fixDataConsistency();
  console.log("数据库初始化完成");
}

module.exports = { initAll, checkItemsData };
