const app = {
  currentPage: "versions",
  versionList: {
    page: 1,
    pageSize: 10,
    status: "all",
    vendor: "all",
    keyword: "",
    total: 0,
    list: [],
  },
  appealList: {
    page: 1,
    pageSize: 10,
    status: "all",
    total: 0,
    list: [],
  },
};

function formatTime(timeStr) {
  if (!timeStr) return "-";
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return timeStr;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showModal(content, options = {}) {
  const container = document.getElementById("modal-container");
  const sizeClass = options.size === "lg" ? "modal-lg" : "";
  container.innerHTML = `
    <div class="modal-mask" onclick="if(event.target === this) closeModal()">
      <div class="modal ${sizeClass}">
        <div class="modal-header">
          <h3>${options.title || "提示"}</h3>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">${content}</div>
        ${
          options.footer !== undefined
            ? options.footer
            : `
          <div class="modal-footer">
            <button class="btn btn-default" onclick="closeModal()">取消</button>
            ${options.confirmText ? `<button class="btn btn-primary" onclick="${options.onConfirm}">${options.confirmText}</button>` : ""}
          </div>
        `
        }
      </div>
    </div>
  `;
}

function closeModal() {
  document.getElementById("modal-container").innerHTML = "";
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    padding: 12px 24px; border-radius: 4px; color: #fff; z-index: 2000;
    font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    background: ${type === "success" ? "#52c41a" : type === "error" ? "#ff4d4f" : "#1890ff"};
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function navigateTo(page) {
  app.currentPage = page;
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === page);
  });
  const titleMap = {
    versions: "版本审核",
    appeals: "申辩管理",
    checklists: "清单配置",
    stats: "数据统计",
  };
  document.getElementById("page-title").textContent = titleMap[page] || page;

  if (page === "versions") renderVersionsPage();
  if (page === "appeals") renderAppealsPage();
  if (page === "checklists") renderChecklistsPage();
  if (page === "stats") renderStatsPage();
}

async function renderVersionsPage() {
  const container = document.getElementById("page-container");

  const [vendorsRes, versionsRes] = await Promise.all([
    api.getVendors(),
    api.getVersions({
      page: app.versionList.page,
      pageSize: app.versionList.pageSize,
      status: app.versionList.status,
      vendor: app.versionList.vendor,
      keyword: app.versionList.keyword,
    }),
  ]);

  const vendors = vendorsRes.data || [];
  const { list, total } = versionsRes.data;
  app.versionList.total = total;
  app.versionList.list = list;

  const totalPages = Math.ceil(total / app.versionList.pageSize);

  const statusOptions = [
    { value: "all", label: "全部状态" },
    { value: "pending", label: "待审" },
    { value: "reviewing", label: "审核中" },
    { value: "rejected", label: "驳回" },
    { value: "approved", label: "通过上架" },
  ];

  container.innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <div class="filter-item">
          <label>状态：</label>
          <select id="filter-status">
            ${statusOptions.map((s) => `<option value="${s.value}" ${app.versionList.status === s.value ? "selected" : ""}>${s.label}</option>`).join("")}
          </select>
        </div>
        <div class="filter-item">
          <label>厂商：</label>
          <select id="filter-vendor">
            <option value="all">全部厂商</option>
            ${vendors.map((v) => `<option value="${v}" ${app.versionList.vendor === v ? "selected" : ""}>${v}</option>`).join("")}
          </select>
        </div>
        <div class="filter-item">
          <input type="text" id="filter-keyword" placeholder="搜索应用名/版本号" value="${app.versionList.keyword}">
        </div>
        <button class="btn btn-primary" onclick="handleSearch()">🔍 搜索</button>
        <button class="btn btn-default" onclick="handleResetSearch()">重置</button>
        <button class="btn btn-success" onclick="showSubmitModal()" style="margin-left: auto;">➕ 提交新版本</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>应用名称</th>
            <th>版本号</th>
            <th>厂商</th>
            <th>状态</th>
            <th>驳回次数</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            list.length === 0
              ? '<tr><td colspan="7" class="empty">暂无数据</td></tr>'
              : list
                  .map(
                    (item) => `
            <tr>
              <td><strong>${item.app_name}</strong></td>
              <td>${item.version_no}</td>
              <td>${item.vendor}</td>
              <td>
                ${
                  item.shelf_status === "off_shelf"
                    ? '<span class="status-tag status-off-shelf">已下架</span>'
                    : `<span class="status-tag status-${item.status}">${item.status_text}</span>`
                }
              </td>
              <td>${item.reject_count} 次</td>
              <td>${formatTime(item.submit_time)}</td>
              <td>
                <button class="link-btn" onclick="viewVersion(${item.id})">详情</button>
                ${
                  item.status === "pending"
                    ? `<button class="link-btn" onclick="startReview(${item.id})" style="margin-left: 8px;">开始审核</button>`
                    : ""
                }
                ${
                  item.status === "approved" &&
                  item.shelf_status !== "off_shelf"
                    ? `<button class="link-btn danger" onclick="showOffShelfModal(${item.id})" style="margin-left: 8px;">强制下架</button>`
                    : ""
                }
                ${
                  item.status === "rejected"
                    ? `<button class="link-btn" onclick="reSubmitVersion(${item.id})" style="margin-left: 8px;">重新提交</button>`
                    : ""
                }
              </td>
            </tr>
          `,
                  )
                  .join("")
          }
        </tbody>
      </table>

      <div class="pagination">
        <span class="pagination-info">共 ${total} 条</span>
        <button class="pagination-btn" onclick="goToPage(1)" ${app.versionList.page <= 1 ? "disabled" : ""}>首页</button>
        <button class="pagination-btn" onclick="goToPage(${app.versionList.page - 1})" ${app.versionList.page <= 1 ? "disabled" : ""}>上一页</button>
        ${renderPageNumbers(totalPages)}
        <button class="pagination-btn" onclick="goToPage(${app.versionList.page + 1})" ${app.versionList.page >= totalPages ? "disabled" : ""}>下一页</button>
        <button class="pagination-btn" onclick="goToPage(${totalPages})" ${app.versionList.page >= totalPages ? "disabled" : ""}>末页</button>
      </div>
    </div>
  `;
}

function renderPageNumbers(totalPages) {
  const current = app.versionList.page;
  let pages = [];
  let start = Math.max(1, current - 2);
  let end = Math.min(totalPages, current + 2);

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push("...");
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);
  }

  return pages
    .map((p) =>
      p === "..."
        ? '<span style="padding: 0 8px; color: #999;">...</span>'
        : `<button class="pagination-btn ${p === current ? "active" : ""}" onclick="goToPage(${p})">${p}</button>`,
    )
    .join("");
}

function goToPage(page) {
  app.versionList.page = page;
  renderVersionsPage();
}

function handleSearch() {
  app.versionList.status = document.getElementById("filter-status").value;
  app.versionList.vendor = document.getElementById("filter-vendor").value;
  app.versionList.keyword = document.getElementById("filter-keyword").value;
  app.versionList.page = 1;
  renderVersionsPage();
}

function handleResetSearch() {
  app.versionList.status = "all";
  app.versionList.vendor = "all";
  app.versionList.keyword = "";
  app.versionList.page = 1;
  renderVersionsPage();
}

async function viewVersion(id) {
  const res = await api.getVersion(id);
  if (res.code !== 0) {
    showToast(res.message || "获取失败", "error");
    return;
  }
  const v = res.data;

  const recordsHtml =
    v.review_records.length > 0
      ? v.review_records
          .map(
            (record) => `
      <div class="review-record">
        <div class="review-record-header">
          <span class="review-record-round">第 ${record.review_round} 轮审核</span>
          <div class="review-record-result">
            <span>审核员：${record.reviewer}</span>
            <span>开始：${formatTime(record.start_time)}</span>
            ${record.end_time ? `<span>结束：${formatTime(record.end_time)}</span>` : ""}
            ${record.result ? `<span class="status-tag status-${record.result}">${record.result === "approved" ? "通过" : "驳回"}</span>` : ""}
          </div>
        </div>
        ${
          record.checklist_version_id
            ? `
          <div class="checklist-version-info" style="background: #f0f5ff; padding: 8px 12px; margin: 8px 0; border-radius: 4px; font-size: 13px;">
            📋 使用清单：<strong>${record.template_name}</strong> 
            版本：<strong>${record.checklist_version_no}</strong>
            (创建时间：${formatTime(record.checklist_created_at)})
          </div>
        `
            : ""
        }
        ${record.reject_reason ? `<div class="reject-reason">驳回原因：${record.reject_reason}</div>` : ""}
        <div>
          ${record.items
            .map(
              (item) => `
            <div class="review-item" style="position: relative;">
              <span class="review-item-icon">${
                item.result === "pass"
                  ? "✅"
                  : item.appeal_result === "accepted"
                    ? "🟡"
                    : "❌"
              }</span>
              <div class="review-item-content" style="flex: 1;">
                <div class="review-item-name">${item.name}
                  ${
                    item.appeal_id
                      ? `<span class="status-tag ${
                          item.appeal_result === "accepted"
                            ? "status-pending"
                            : "status-rejected"
                        }" style="margin-left: 8px; font-size: 11px;">
                          ${
                            item.appeal_result === "accepted"
                              ? "申辩采纳"
                              : item.appeal_result === "rejected"
                                ? "申辩驳回"
                                : "待申辩审核"
                          }
                        </span>`
                      : ""
                  }
                </div>
                ${item.comment ? `<div class="review-item-comment">${item.comment}</div>` : ""}
                ${
                  item.appeal_id
                    ? `
                  <div class="appeal-info" style="background: #fff7e6; padding: 8px 12px; margin-top: 8px; border-radius: 4px; font-size: 12px;">
                    <div><strong>申辩内容：</strong>${item.appeal_content}</div>
                    <div style="margin-top: 4px;"><small>提交时间：${formatTime(item.appeal_submitted_at)}</small></div>
                    ${
                      item.appeal_review_comment
                        ? `<div style="margin-top: 4px;"><strong>审核意见：</strong>${item.appeal_review_comment}</div>`
                        : ""
                    }
                  </div>
                `
                    : ""
                }
              </div>
              ${
                v.status === "rejected" &&
                item.result === "fail" &&
                !item.has_appeal &&
                !item.appeal_id
                  ? `
                <button class="btn btn-sm btn-default" style="margin-left: 10px;" 
                        onclick="showAppealModal(${v.id}, ${item.id}, '${item.name.replace(/'/g, "\\'")}')">
                  📝 申辩
                </button>
              `
                  : ""
              }
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `,
          )
          .join("")
      : '<div class="empty">暂无审核记录</div>';

  const content = `
    <div class="version-info" style="grid-template-columns: repeat(3, 1fr);">
      <div class="info-item">
        <span class="info-label">应用名称</span>
        <span class="info-value">${v.app_name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">版本号</span>
        <span class="info-value">${v.version_no}</span>
      </div>
      <div class="info-item">
        <span class="info-label">厂商</span>
        <span class="info-value">${v.vendor}</span>
      </div>
      <div class="info-item">
        <span class="info-label">应用类别</span>
        <span class="info-value">${v.category_name || "未设置"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">当前状态</span>
        <span class="info-value">
          ${
            v.shelf_status === "off_shelf"
              ? '<span class="status-tag status-off-shelf">已下架</span>'
              : `<span class="status-tag status-${v.status}">${v.status_text}</span>`
          }
        </span>
      </div>
      <div class="info-item">
        <span class="info-label">驳回次数</span>
        <span class="info-value">${v.reject_count} 次</span>
      </div>
      <div class="info-item">
        <span class="info-label">提交时间</span>
        <span class="info-value">${formatTime(v.submit_time)}</span>
      </div>
    </div>

    ${
      v.shelf_status === "off_shelf"
        ? `
      <div class="shelf-off-info">
        <strong>下架原因：</strong>${v.shelf_off_reason || "无"}
        <br><small style="margin-top: 4px; display: block;">下架时间：${formatTime(v.shelf_off_time)}</small>
      </div>
    `
        : ""
    }

    <div class="section-title">审核记录</div>
    ${recordsHtml}
  `;

  let footer = "";
  if (v.status === "pending") {
    footer = `
      <div class="modal-footer">
        <button class="btn btn-default" onclick="closeModal()">关闭</button>
        <button class="btn btn-primary" onclick="startReview(${v.id}); closeModal();">开始审核</button>
      </div>
    `;
  } else if (v.status === "rejected") {
    footer = `
      <div class="modal-footer">
        <button class="btn btn-default" onclick="closeModal()">关闭</button>
        <button class="btn btn-primary" onclick="reSubmitVersion(${v.id}); closeModal();">重新提交</button>
      </div>
    `;
  } else if (v.status === "approved" && v.shelf_status !== "off_shelf") {
    footer = `
      <div class="modal-footer">
        <button class="btn btn-default" onclick="closeModal()">关闭</button>
        <button class="btn btn-danger" onclick="showOffShelfModal(${v.id})">强制下架</button>
      </div>
    `;
  }

  showModal(content, { title: "版本详情", size: "lg", footer });
}

function showAppealModal(versionId, reviewItemResultId, itemName) {
  const content = `
    <div style="margin-bottom: 16px;">
      <strong>申诉项：</strong>${itemName}
    </div>
    <div class="form-item">
      <label class="required">申辩内容</label>
      <textarea id="appeal-content" placeholder="请详细说明申诉理由..." style="width: 100%; min-height: 120px;"></textarea>
    </div>
    <div class="form-item">
      <label class="required">厂商名称</label>
      <input type="text" id="appeal-vendor-name" placeholder="请输入厂商名称" style="width: 100%;">
    </div>
  `;

  const footer = `
    <div class="modal-footer">
      <button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitAppeal(${versionId}, ${reviewItemResultId})">提交申辩</button>
    </div>
  `;

  showModal(content, { title: "提交申辩", footer });
}

async function submitAppeal(versionId, reviewItemResultId) {
  const content = document.getElementById("appeal-content").value.trim();
  const vendorName = document.getElementById("appeal-vendor-name").value.trim();

  if (!content || !vendorName) {
    showToast("请填写完整信息", "error");
    return;
  }

  const res = await api.submitAppeal({
    review_item_result_id: reviewItemResultId,
    vendor_id: vendorName,
    vendor_name: vendorName,
    content,
  });

  if (res.code !== 0) {
    showToast(res.message || "提交失败", "error");
    return;
  }

  showToast("申辩提交成功");
  closeModal();
  viewVersion(versionId);
}

async function startReview(versionId) {
  const res = await api.startReview(versionId, "管理员");
  if (res.code !== 0) {
    showToast(res.message || "操作失败", "error");
    return;
  }
  showToast("已开始审核");
  showReviewModal(versionId);
}

async function showReviewModal(versionId) {
  const [versionRes, itemsRes] = await Promise.all([
    api.getVersion(versionId),
    api.getCheckItems(versionId),
  ]);

  if (versionRes.code !== 0 || itemsRes.code !== 0) {
    showToast("获取数据失败", "error");
    return;
  }

  const version = versionRes.data;
  const checkItems = itemsRes.data;

  if (version.status !== "reviewing") {
    showToast("当前状态不可审核", "error");
    return;
  }

  const latestRecord =
    version.review_records && version.review_records.length > 0
      ? version.review_records[0]
      : null;

  let checklistInfo = "";
  if (latestRecord && latestRecord.checklist_version_id) {
    checklistInfo = `
      <div class="checklist-version-info" style="background: #f0f5ff; padding: 12px; margin-bottom: 16px; border-radius: 4px; font-size: 13px;">
        📋 <strong>使用清单：</strong>${latestRecord.template_name} 
        <strong>版本：</strong>${latestRecord.checklist_version_no}
        <small style="color: #666; margin-left: 8px;">
          (创建时间：${formatTime(latestRecord.checklist_created_at)}，创建人：${latestRecord.checklist_created_by || "系统"})
        </small>
      </div>
    `;
  }

  const itemsHtml = checkItems
    .map(
      (item, index) => `
    <div class="check-item unreviewed" id="check-item-${item.id}">
      <div class="check-item-header">
        <div class="check-item-info">
          <span class="check-item-category">${item.category}</span>
          <div class="check-item-name">${index + 1}. ${item.name}</div>
          <div class="check-item-desc">${item.description || ""}</div>
        </div>
        <span class="review-status-badge" id="status-badge-${item.id}">未审核</span>
      </div>
      <div class="result-options">
        <label class="result-option">
          <input type="radio" name="item-${item.id}" value="pass" onchange="updateCheckItemResult(${item.id}, 'pass')">
          ✅ 通过
        </label>
        <label class="result-option">
          <input type="radio" name="item-${item.id}" value="fail" onchange="updateCheckItemResult(${item.id}, 'fail')">
          ❌ 不通过
        </label>
      </div>
      <textarea class="check-item-comment" id="comment-${item.id}" placeholder="请填写不通过原因..."></textarea>
    </div>
  `,
    )
    .join("");

  const content = `
    <div class="version-info" style="grid-template-columns: repeat(4, 1fr);">
      <div class="info-item">
        <span class="info-label">应用名称</span>
        <span class="info-value">${version.app_name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">版本号</span>
        <span class="info-value">${version.version_no}</span>
      </div>
      <div class="info-item">
        <span class="info-label">厂商</span>
        <span class="info-value">${version.vendor}</span>
      </div>
      <div class="info-item">
        <span class="info-label">应用类别</span>
        <span class="info-value">${version.category_name || "未设置"}</span>
      </div>
    </div>

    ${checklistInfo}

    <div class="section-title">合规检查清单</div>
    <div id="check-list">
      ${itemsHtml}
    </div>

    <div class="form-item" style="margin-top: 20px;">
      <label>总体驳回原因（如有不通过项必填）</label>
      <textarea id="reject-reason" placeholder="如有不通过项，请填写总体驳回原因..." style="width: 100%; min-height: 80px;"></textarea>
    </div>
  `;

  const footer = `
    <div class="modal-footer">
      <button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitReviewResult(${versionId})">提交审核结果</button>
    </div>
  `;

  showModal(content, {
    title: "审核 - " + version.app_name + " " + version.version_no,
    size: "lg",
    footer,
  });

  window.currentCheckItems = checkItems;
}

function updateCheckItemResult(itemId, result) {
  const itemEl = document.getElementById(`check-item-${itemId}`);
  const commentEl = document.getElementById(`comment-${itemId}`);
  const badgeEl = document.getElementById(`status-badge-${itemId}`);

  itemEl.classList.remove("unreviewed", "pass", "fail");
  itemEl.classList.add(result);

  if (result === "fail") {
    commentEl.style.display = "block";
    badgeEl.textContent = "不通过";
    badgeEl.className = "review-status-badge status-fail";
  } else {
    commentEl.style.display = "none";
    badgeEl.textContent = "通过";
    badgeEl.className = "review-status-badge status-pass";
  }
}

async function submitReviewResult(versionId) {
  const items = window.currentCheckItems || [];
  const results = [];
  const unreviewedItems = [];

  for (const item of items) {
    const radios = document.getElementsByName(`item-${item.id}`);
    let result = null;
    for (const r of radios) {
      if (r.checked) {
        result = r.value;
        break;
      }
    }
    if (!result) {
      unreviewedItems.push(item.name);
      continue;
    }
    const commentEl = document.getElementById(`comment-${item.id}`);
    results.push({
      check_item_id: item.id,
      result,
      comment: result === "fail" ? commentEl.value : null,
    });
  }

  if (unreviewedItems.length > 0) {
    showToast(
      `还有 ${unreviewedItems.length} 项未审核：${unreviewedItems[0]}${unreviewedItems.length > 1 ? "等" : ""}`,
      "error",
    );
    return;
  }

  const hasFail = results.some((r) => r.result === "fail");
  const rejectReason = document.getElementById("reject-reason").value;

  if (hasFail && !rejectReason.trim()) {
    showToast("请填写总体驳回原因", "error");
    return;
  }

  const failItems = results.filter((r) => r.result === "fail");
  for (const item of failItems) {
    if (!item.comment || !item.comment.trim()) {
      showToast("请为所有不通过项填写原因", "error");
      return;
    }
  }

  const res = await api.submitReview(versionId, {
    results,
    rejectReason: hasFail ? rejectReason : null,
    reviewer: "管理员",
  });

  if (res.code !== 0) {
    showToast(res.message || "提交失败", "error");
    return;
  }

  showToast(res.message || "提交成功");
  closeModal();
  renderVersionsPage();
}

async function showSubmitModal() {
  const categoriesRes = await api.getCategories();
  const categories = categoriesRes.data || [];

  const content = `
    <div class="form-item">
      <label class="required">应用名称</label>
      <input type="text" id="new-app-name" placeholder="请输入应用名称" style="width: 100%;">
    </div>
    <div class="form-item">
      <label class="required">版本号</label>
      <input type="text" id="new-version-no" placeholder="请输入版本号，如 1.0.0" style="width: 100%;">
    </div>
    <div class="form-item">
      <label class="required">厂商</label>
      <input type="text" id="new-vendor" placeholder="请输入厂商名称" style="width: 100%;">
    </div>
    <div class="form-item">
      <label class="required">应用类别</label>
      <select id="new-category-id" style="width: 100%;">
        <option value="">请选择应用类别</option>
        ${categories
          .map(
            (c) =>
              `<option value="${c.id}">${c.name}${c.description ? ` - ${c.description}` : ""}</option>`,
          )
          .join("")}
      </select>
    </div>
  `;

  const footer = `
    <div class="modal-footer">
      <button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitNewVersion()">提交</button>
    </div>
  `;

  showModal(content, { title: "提交新版本", footer });
}

async function submitNewVersion() {
  const appName = document.getElementById("new-app-name").value.trim();
  const versionNo = document.getElementById("new-version-no").value.trim();
  const vendor = document.getElementById("new-vendor").value.trim();
  const categoryId = document.getElementById("new-category-id").value;

  if (!appName || !versionNo || !vendor || !categoryId) {
    showToast("请填写完整信息", "error");
    return;
  }

  const res = await api.submitVersion({
    app_name: appName,
    version_no: versionNo,
    vendor,
    category_id: parseInt(categoryId),
  });

  if (res.code !== 0) {
    showToast(res.message || "提交失败", "error");
    return;
  }

  showToast("提交成功");
  closeModal();
  renderVersionsPage();
}

function showOffShelfModal(versionId) {
  const content = `
    <div class="form-item">
      <label class="required">下架原因</label>
      <textarea id="off-shelf-reason" placeholder="请填写下架原因..." style="width: 100%; min-height: 100px;"></textarea>
    </div>
    <p style="color: #ff4d4f; font-size: 12px;">⚠️ 下架后该版本将从应用商店移除，请谨慎操作</p>
  `;

  const footer = `
    <div class="modal-footer">
      <button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-danger" onclick="confirmOffShelf(${versionId})">确认下架</button>
    </div>
  `;

  showModal(content, { title: "强制下架", footer });
}

async function confirmOffShelf(versionId) {
  const reason = document.getElementById("off-shelf-reason").value.trim();
  if (!reason) {
    showToast("请填写下架原因", "error");
    return;
  }

  const res = await api.offShelf(versionId, reason);
  if (res.code !== 0) {
    showToast(res.message || "操作失败", "error");
    return;
  }

  showToast("已强制下架");
  closeModal();
  renderVersionsPage();
}

async function reSubmitVersion(versionId) {
  if (!confirm("确定要重新提交该版本审核吗？")) return;

  const res = await api.reSubmit(versionId);
  if (res.code !== 0) {
    showToast(res.message || "操作失败", "error");
    return;
  }

  showToast("已重新提交");
  renderVersionsPage();
}

async function renderAppealsPage() {
  const container = document.getElementById("page-container");

  const statusOptions = [
    { value: "all", label: "全部状态" },
    { value: "pending", label: "待审核" },
    { value: "reviewed", label: "已处理" },
  ];

  const res = await api.getAppeals({
    page: app.appealList.page,
    pageSize: app.appealList.pageSize,
    status: app.appealList.status,
  });

  const { list, total } = res.data;
  app.appealList.total = total;
  app.appealList.list = list;

  const totalPages = Math.ceil(total / app.appealList.pageSize);

  const statusMap = {
    pending: "待审核",
    reviewed: "已处理",
  };

  const reviewResultMap = {
    accepted: "采纳",
    rejected: "维持原判",
  };

  container.innerHTML = `
    <div class="card">
      <div class="filter-bar">
        <div class="filter-item">
          <label>状态：</label>
          <select id="appeal-filter-status">
            ${statusOptions
              .map(
                (s) =>
                  `<option value="${s.value}" ${
                    app.appealList.status === s.value ? "selected" : ""
                  }>${s.label}</option>`,
              )
              .join("")}
          </select>
        </div>
        <button class="btn btn-primary" onclick="handleAppealSearch()">🔍 搜索</button>
        <button class="btn btn-default" onclick="handleAppealResetSearch()">重置</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>应用名称</th>
            <th>版本号</th>
            <th>厂商</th>
            <th>检查项</th>
            <th>提交时间</th>
            <th>状态</th>
            <th>处理结果</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            list.length === 0
              ? '<tr><td colspan="8" class="empty">暂无数据</td></tr>'
              : list
                  .map(
                    (item) => `
            <tr>
              <td><strong>${item.app_name}</strong></td>
              <td>${item.version_no}</td>
              <td>${item.vendor_name}</td>
              <td>${item.check_item_name || "-"}</td>
              <td>${formatTime(item.submitted_at)}</td>
              <td>
                <span class="status-tag ${
                  item.status === "pending"
                    ? "status-pending"
                    : "status-approved"
                }">
                  ${statusMap[item.status] || item.status}
                </span>
              </td>
              <td>
                ${
                  item.review_result
                    ? `<span class="status-tag ${
                        item.review_result === "accepted"
                          ? "status-approved"
                          : "status-rejected"
                      }">
                        ${reviewResultMap[item.review_result] || item.review_result}
                      </span>`
                    : "-"
                }
              </td>
              <td>
                <button class="link-btn" onclick="viewAppeal(${item.id})">查看</button>
                ${
                  item.status === "pending"
                    ? `<button class="link-btn" onclick="showReviewAppealModal(${item.id})" style="margin-left: 8px;">处理</button>`
                    : ""
                }
              </td>
            </tr>
          `,
                  )
                  .join("")
          }
        </tbody>
      </table>

      <div class="pagination">
        <span class="pagination-info">共 ${total} 条</span>
        <button class="pagination-btn" onclick="goToAppealPage(1)" ${
          app.appealList.page <= 1 ? "disabled" : ""
        }>首页</button>
        <button class="pagination-btn" onclick="goToAppealPage(${
          app.appealList.page - 1
        })" ${app.appealList.page <= 1 ? "disabled" : ""}>上一页</button>
        <button class="pagination-btn" onclick="goToAppealPage(${
          app.appealList.page + 1
        })" ${app.appealList.page >= totalPages ? "disabled" : ""}>下一页</button>
        <button class="pagination-btn" onclick="goToAppealPage(${totalPages})" ${
          app.appealList.page >= totalPages ? "disabled" : ""
        }>末页</button>
      </div>
    </div>
  `;
}

function handleAppealSearch() {
  app.appealList.status = document.getElementById("appeal-filter-status").value;
  app.appealList.page = 1;
  renderAppealsPage();
}

function handleAppealResetSearch() {
  app.appealList.status = "all";
  app.appealList.page = 1;
  renderAppealsPage();
}

function goToAppealPage(page) {
  app.appealList.page = page;
  renderAppealsPage();
}

async function viewAppeal(id) {
  const res = await api.getAppeal(id);
  if (res.code !== 0) {
    showToast(res.message || "获取失败", "error");
    return;
  }
  const appeal = res.data;

  const statusMap = {
    pending: "待审核",
    reviewed: "已处理",
  };

  const reviewResultMap = {
    accepted: "采纳",
    rejected: "维持原判",
  };

  const content = `
    <div class="version-info" style="grid-template-columns: repeat(3, 1fr);">
      <div class="info-item">
        <span class="info-label">应用名称</span>
        <span class="info-value">${appeal.app_name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">版本号</span>
        <span class="info-value">${appeal.version_no}</span>
      </div>
      <div class="info-item">
        <span class="info-label">厂商</span>
        <span class="info-value">${appeal.vendor_name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">使用清单</span>
        <span class="info-value">${appeal.template_name || "-"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">清单版本</span>
        <span class="info-value">${appeal.checklist_version_no || "-"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">审核轮次</span>
        <span class="info-value">第 ${appeal.review_round} 轮</span>
      </div>
    </div>

    <div class="section-title">检查项信息</div>
    <div class="review-item" style="background: #fff7e6; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
      <div class="review-item-content">
        <div class="review-item-name">
          ${appeal.check_item_name || "-"}
          <span class="status-tag status-rejected" style="margin-left: 8px;">不通过</span>
        </div>
        <div class="review-item-comment">分类：${appeal.check_item_category || "-"}</div>
        ${
          appeal.check_item_description
            ? `<div class="review-item-comment" style="margin-top: 4px;">说明：${appeal.check_item_description}</div>`
            : ""
        }
        ${
          appeal.item_comment
            ? `<div class="review-item-comment" style="margin-top: 8px; color: #ff4d4f;">审核不通过原因：${appeal.item_comment}</div>`
            : ""
        }
      </div>
    </div>

    <div class="section-title">申辩内容</div>
    <div style="background: #f6ffed; padding: 16px; border-radius: 4px; line-height: 1.8; margin-bottom: 16px;">
      ${appeal.content}
    </div>

    <div style="font-size: 13px; color: #666; margin-bottom: 16px;">
      提交时间：${formatTime(appeal.submitted_at)}
    </div>

    ${
      appeal.status === "reviewed"
        ? `
      <div class="section-title">处理结果</div>
      <div style="background: #f0f5ff; padding: 16px; border-radius: 4px; margin-bottom: 8px;">
        <div style="margin-bottom: 8px;">
          处理结果：<span class="status-tag ${
            appeal.review_result === "accepted"
              ? "status-approved"
              : "status-rejected"
          }">
            ${reviewResultMap[appeal.review_result] || appeal.review_result}
          </span>
        </div>
        <div style="margin-bottom: 8px;">处理人：${appeal.reviewer || "-"}</div>
        ${
          appeal.review_comment
            ? `<div>审核意见：${appeal.review_comment}</div>`
            : ""
        }
        <div style="font-size: 13px; color: #666; margin-top: 8px;">
          处理时间：${formatTime(appeal.reviewed_at)}
        </div>
      </div>
    `
        : ""
    }
  `;

  let footer = "";
  if (appeal.status === "pending") {
    footer = `
      <div class="modal-footer">
        <button class="btn btn-default" onclick="closeModal()">关闭</button>
        <button class="btn btn-primary" onclick="showReviewAppealModal(${appeal.id})">处理</button>
      </div>
    `;
  }

  showModal(content, { title: "申辩详情", size: "lg", footer });
}

function showReviewAppealModal(id) {
  const content = `
    <div class="form-item">
      <label class="required">处理结果</label>
      <select id="appeal-review-result" style="width: 100%;">
        <option value="">请选择处理结果</option>
        <option value="accepted">采纳 - 修改为通过</option>
        <option value="rejected">维持原判</option>
      </select>
    </div>
    <div class="form-item">
      <label>审核意见</label>
      <textarea id="appeal-review-comment" placeholder="请填写审核意见..." style="width: 100%; min-height: 100px;"></textarea>
    </div>
  `;

  const footer = `
    <div class="modal-footer">
      <button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitAppealReview(${id})">确认处理</button>
    </div>
  `;

  showModal(content, { title: "处理申辩", footer });
}

async function submitAppealReview(id) {
  const reviewResult = document.getElementById("appeal-review-result").value;
  const reviewComment = document
    .getElementById("appeal-review-comment")
    .value.trim();

  if (!reviewResult) {
    showToast("请选择处理结果", "error");
    return;
  }

  const res = await api.reviewAppeal(id, {
    review_result: reviewResult,
    review_comment: reviewComment || null,
    reviewer: "管理员",
  });

  if (res.code !== 0) {
    showToast(res.message || "处理失败", "error");
    return;
  }

  showToast(res.message || "处理成功");
  closeModal();
  renderAppealsPage();
}

async function renderChecklistsPage() {
  const container = document.getElementById("page-container");

  const [templatesRes, versionsRes, categoriesRes, mappingRes, checkItemsRes] =
    await Promise.all([
      api.getTemplates(true),
      api.getChecklistVersions(),
      api.getCategories(),
      api.getCategoryTemplateMapping(),
      api.getAllCheckItems(true),
    ]);

  const templates = templatesRes.data || [];
  const versions = versionsRes.data || [];
  const categories = categoriesRes.data || [];
  const mappings = mappingRes.data || [];
  const checkItems = checkItemsRes.data || [];

  const templatesHtml = templates
    .map(
      (t) => `
    <div class="card" style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <h3 style="margin: 0;">📋 ${t.name}</h3>
          <p style="margin: 4px 0 0 0; color: #666; font-size: 13px;">${
            t.description || "暂无描述"
          }</p>
        </div>
        <div>
          <button class="btn btn-sm btn-default" onclick="showEditTemplateModal(${t.id}, '${t.name.replace(
            /'/g,
            "\\'",
          )}', '${(t.description || "").replace(/'/g, "\\'")}')">编辑</button>
          <button class="btn btn-sm btn-primary" style="margin-left: 8px;" onclick="showCreateVersionModal(${t.id}, '${t.name.replace(
            /'/g,
            "\\'",
          )}')">发布新版本</button>
        </div>
      </div>
      <div style="margin-bottom: 8px; font-size: 13px; color: #666;">
        包含检查项：${t.items ? t.items.length : 0} 项
      </div>
      ${
        t.items && t.items.length > 0
          ? `
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${t.items
            .map(
              (item) => `
            <span style="background: #f0f5ff; padding: 4px 10px; border-radius: 12px; font-size: 12px;">
              ${item.name}
            </span>
          `,
            )
            .join("")}
        </div>
      `
          : ""
      }
    </div>
  `,
    )
    .join("");

  const versionsHtml = versions
    .map(
      (v) => `
    <tr>
      <td>${v.template_name}</td>
      <td><strong>${v.version_no}</strong></td>
      <td>${v.description || "-"}</td>
      <td>${v.created_by || "-"}</td>
      <td>${formatTime(v.created_at)}</td>
      <td>
        <span class="status-tag ${
          v.is_locked ? "status-approved" : "status-pending"
        }">
          ${v.is_locked ? "已锁定" : "草稿"}
        </span>
      </td>
      <td>
        <button class="link-btn" onclick="viewChecklistVersion(${v.id})">查看</button>
      </td>
    </tr>
  `,
    )
    .join("");

  const categoriesHtml = categories
    .map(
      (c) => `
    <tr>
      <td>${c.name}</td>
      <td>${c.description || "-"}</td>
      <td>
        ${
          mappings
            .filter((m) => m.category_id === c.id)
            .map((m) => m.template_name)
            .join("、") || "-"
        }
      </td>
    </tr>
  `,
    )
    .join("");

  const checkItemsHtml = checkItems
    .map(
      (item) => `
    <tr>
      <td><code>${item.code}</code></td>
      <td>${item.name}</td>
      <td>${item.category}</td>
      <td>${item.description || "-"}</td>
      <td>
        <button class="link-btn" onclick="showEditCheckItemModal(${item.id}, '${item.code.replace(
          /'/g,
          "\\'",
        )}', '${item.name.replace(/'/g, "\\'")}', '${item.category.replace(
          /'/g,
          "\\'",
        )}', '${(item.description || "").replace(/'/g, "\\'")}')">编辑</button>
      </td>
    </tr>
  `,
    )
    .join("");

  container.innerHTML = `
    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0;">📑 清单模板</h3>
        <button class="btn btn-primary" onclick="showCreateTemplateModal()">➕ 新建模板</button>
      </div>
      ${templatesHtml || '<div class="empty">暂无模板</div>'}
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0;">📌 清单版本记录</h3>
      </div>
      <table>
        <thead>
          <tr>
            <th>模板名称</th>
            <th>版本号</th>
            <th>说明</th>
            <th>创建人</th>
            <th>创建时间</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${versionsHtml || '<tr><td colspan="7" class="empty">暂无版本</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0;">🏷️ 应用类别</h3>
        <button class="btn btn-primary" onclick="showCreateCategoryModal()">➕ 新建类别</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>类别名称</th>
            <th>说明</th>
            <th>关联清单模板</th>
          </tr>
        </thead>
        <tbody>
          ${categoriesHtml || '<tr><td colspan="3" class="empty">暂无类别</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0;">🔍 检查项库</h3>
        <button class="btn btn-primary" onclick="showCreateCheckItemModal()">➕ 新建检查项</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>编码</th>
            <th>名称</th>
            <th>分类</th>
            <th>描述</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${checkItemsHtml || '<tr><td colspan="5" class="empty">暂无检查项</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  window.currentTemplates = templates;
  window.currentCategories = categories;
  window.currentCheckItems = checkItems;
}

function showCreateTemplateModal() {
  const checkItems = window.currentCheckItems || [];
  const categories = window.currentCategories || [];

  const content = `
    <div class="form-item">
      <label class="required">模板名称</label>
      <input type="text" id="new-template-name" placeholder="请输入模板名称" style="width: 100%;">
    </div>
    <div class="form-item">
      <label>描述</label>
      <textarea id="new-template-desc" placeholder="请输入模板描述..." style="width: 100%; min-height: 60px;"></textarea>
    </div>
    <div class="form-item">
      <label>包含检查项</label>
      <div style="max-height: 200px; overflow-y: auto; border: 1px solid #d9d9d9; border-radius: 4px; padding: 8px;">
        ${checkItems
          .map(
            (item) => `
          <label style="display: block; padding: 4px 0; cursor: pointer;">
            <input type="checkbox" name="template-item" value="${item.id}">
            <span style="margin-left: 4px;">${item.name}</span>
            <span style="color: #999; font-size: 12px; margin-left: 8px;">[${item.category}]</span>
          </label>
        `,
          )
          .join("")}
      </div>
    </div>
  `;

  const footer = `
    <div class="modal-footer">
      <button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitCreateTemplate()">创建</button>
    </div>
  `;

  showModal(content, { title: "新建清单模板", size: "lg", footer });
}

async function submitCreateTemplate() {
  const name = document.getElementById("new-template-name").value.trim();
  const description = document.getElementById("new-template-desc").value.trim();
  const itemCheckboxes = document.querySelectorAll(
    'input[name="template-item"]:checked',
  );
  const itemIds = Array.from(itemCheckboxes).map((cb) => parseInt(cb.value));

  if (!name) {
    showToast("请输入模板名称", "error");
    return;
  }

  const res = await api.createTemplate({
    name,
    description: description || null,
    item_ids: itemIds,
  });

  if (res.code !== 0) {
    showToast(res.message || "创建失败", "error");
    return;
  }

  showToast("创建成功");
  closeModal();
  renderChecklistsPage();
}

function showEditTemplateModal(id, name, description) {
  const checkItems = window.currentCheckItems || [];
  const template = window.currentTemplates?.find((t) => t.id === id);
  const selectedItemIds = template?.items?.map((item) => item.id) || [];

  const content = `
    <div class="form-item">
      <label class="required">模板名称</label>
      <input type="text" id="edit-template-name" value="${name}" style="width: 100%;">
    </div>
    <div class="form-item">
      <label>描述</label>
      <textarea id="edit-template-desc" style="width: 100%; min-height: 60px;">${description}</textarea>
    </div>
    <div class="form-item">
      <label>包含检查项</label>
      <div style="max-height: 200px; overflow-y: auto; border: 1px solid #d9d9d9; border-radius: 4px; padding: 8px;">
        ${checkItems
          .map(
            (item) => `
          <label style="display: block; padding: 4px 0; cursor: pointer;">
            <input type="checkbox" name="edit-template-item" value="${
              item.id
            }" ${selectedItemIds.includes(item.id) ? "checked" : ""}>
            <span style="margin-left: 4px;">${item.name}</span>
            <span style="color: #999; font-size: 12px; margin-left: 8px;">[${item.category}]</span>
          </label>
        `,
          )
          .join("")}
      </div>
    </div>
  `;

  const footer = `
    <div class="modal-footer">
      <button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitEditTemplate(${id})">保存</button>
    </div>
  `;

  showModal(content, { title: "编辑清单模板", size: "lg", footer });
}

async function submitEditTemplate(id) {
  const name = document.getElementById("edit-template-name").value.trim();
  const description = document
    .getElementById("edit-template-desc")
    .value.trim();
  const itemCheckboxes = document.querySelectorAll(
    'input[name="edit-template-item"]:checked',
  );
  const itemIds = Array.from(itemCheckboxes).map((cb) => parseInt(cb.value));

  if (!name) {
    showToast("请输入模板名称", "error");
    return;
  }

  const res = await api.updateTemplate(id, {
    name,
    description: description || null,
    item_ids: itemIds,
  });

  if (res.code !== 0) {
    showToast(res.message || "更新失败", "error");
    return;
  }

  showToast("更新成功");
  closeModal();
  renderChecklistsPage();
}

function showCreateVersionModal(templateId, templateName) {
  const content = `
    <div style="margin-bottom: 12px;">
      <strong>模板：</strong>${templateName}
    </div>
    <div class="form-item">
      <label class="required">版本号</label>
      <input type="text" id="new-version-no" placeholder="请输入版本号，如 1.0.1" style="width: 100%;">
    </div>
    <div class="form-item">
      <label>版本说明</label>
      <textarea id="new-version-desc" placeholder="请输入版本说明..." style="width: 100%; min-height: 60px;"></textarea>
    </div>
    <div style="font-size: 12px; color: #666; margin-top: 8px;">
      ⚠️ 发布版本后将自动锁定，包含的检查项将生成快照，不能再修改
    </div>
  `;

  const footer = `
    <div class="modal-footer">
      <button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitCreateVersion(${templateId})">发布</button>
    </div>
  `;

  showModal(content, { title: "发布清单新版本", footer });
}

async function submitCreateVersion(templateId) {
  const versionNo = document.getElementById("new-version-no").value.trim();
  const description = document.getElementById("new-version-desc").value.trim();

  if (!versionNo) {
    showToast("请输入版本号", "error");
    return;
  }

  const res = await api.createChecklistVersion({
    template_id: templateId,
    version_no: versionNo,
    description: description || null,
    created_by: "管理员",
  });

  if (res.code !== 0) {
    showToast(res.message || "发布失败", "error");
    return;
  }

  showToast("版本发布成功");
  closeModal();
  renderChecklistsPage();
}

async function viewChecklistVersion(id) {
  const res = await api.getChecklistVersion(id);
  if (res.code !== 0) {
    showToast(res.message || "获取失败", "error");
    return;
  }
  const version = res.data;

  const itemsHtml = version.items
    .map(
      (item, index) => `
    <div class="check-item" style="border: 1px solid #e8e8e8; border-radius: 4px; padding: 12px; margin-bottom: 8px;">
      <div class="check-item-header">
        <div class="check-item-info">
          <span class="check-item-category">${item.check_item_category}</span>
          <div class="check-item-name">${index + 1}. ${item.check_item_name}</div>
          <div class="check-item-desc">${item.check_item_description || ""}</div>
        </div>
      </div>
    </div>
  `,
    )
    .join("");

  const content = `
    <div class="version-info" style="grid-template-columns: repeat(3, 1fr);">
      <div class="info-item">
        <span class="info-label">模板名称</span>
        <span class="info-value">${version.template_name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">版本号</span>
        <span class="info-value"><strong>${version.version_no}</strong></span>
      </div>
      <div class="info-item">
        <span class="info-label">创建人</span>
        <span class="info-value">${version.created_by || "-"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">说明</span>
        <span class="info-value">${version.description || "-"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">创建时间</span>
        <span class="info-value">${formatTime(version.created_at)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">状态</span>
        <span class="info-value">
          <span class="status-tag ${version.is_locked ? "status-approved" : "status-pending"}">
            ${version.is_locked ? "已锁定" : "草稿"}
          </span>
        </span>
      </div>
    </div>

    <div class="section-title">检查项（${version.items.length} 项）</div>
    ${itemsHtml}
  `;

  showModal(content, { title: "清单版本详情", size: "lg" });
}

function showCreateCategoryModal() {
  const content = `
    <div class="form-item">
      <label class="required">类别名称</label>
      <input type="text" id="new-category-name" placeholder="请输入类别名称，如：游戏类" style="width: 100%;">
    </div>
    <div class="form-item">
      <label>说明</label>
      <textarea id="new-category-desc" placeholder="请输入类别说明..." style="width: 100%; min-height: 60px;"></textarea>
    </div>
  `;

  const footer = `
    <div class="modal-footer">
      <button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitCreateCategory()">创建</button>
    </div>
  `;

  showModal(content, { title: "新建应用类别", footer });
}

async function submitCreateCategory() {
  const name = document.getElementById("new-category-name").value.trim();
  const description = document.getElementById("new-category-desc").value.trim();

  if (!name) {
    showToast("请输入类别名称", "error");
    return;
  }

  const res = await api.createCategory({
    name,
    description: description || null,
  });

  if (res.code !== 0) {
    showToast(res.message || "创建失败", "error");
    return;
  }

  showToast("创建成功");
  closeModal();
  renderChecklistsPage();
}

function showCreateCheckItemModal() {
  const content = `
    <div class="form-item">
      <label class="required">检查项编码</label>
      <input type="text" id="new-checkitem-code" placeholder="请输入唯一编码，如：shake_trigger" style="width: 100%;">
    </div>
    <div class="form-item">
      <label class="required">检查项名称</label>
      <input type="text" id="new-checkitem-name" placeholder="请输入检查项名称" style="width: 100%;">
    </div>
    <div class="form-item">
      <label class="required">分类</label>
      <input type="text" id="new-checkitem-category" placeholder="请输入分类，如：开屏广告" style="width: 100%;">
    </div>
    <div class="form-item">
      <label>描述</label>
      <textarea id="new-checkitem-desc" placeholder="请输入检查项描述..." style="width: 100%; min-height: 60px;"></textarea>
    </div>
  `;

  const footer = `
    <div class="modal-footer">
      <button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitCreateCheckItem()">创建</button>
    </div>
  `;

  showModal(content, { title: "新建检查项", footer });
}

async function submitCreateCheckItem() {
  const code = document.getElementById("new-checkitem-code").value.trim();
  const name = document.getElementById("new-checkitem-name").value.trim();
  const category = document
    .getElementById("new-checkitem-category")
    .value.trim();
  const description = document
    .getElementById("new-checkitem-desc")
    .value.trim();

  if (!code || !name || !category) {
    showToast("请填写完整信息", "error");
    return;
  }

  const res = await api.createCheckItem({
    code,
    name,
    category,
    description: description || null,
    sort_order: 0,
  });

  if (res.code !== 0) {
    showToast(res.message || "创建失败", "error");
    return;
  }

  showToast("创建成功");
  closeModal();
  renderChecklistsPage();
}

function showEditCheckItemModal(id, code, name, category, description) {
  const content = `
    <div class="form-item">
      <label class="required">检查项编码</label>
      <input type="text" id="edit-checkitem-code" value="${code}" style="width: 100%;" readonly>
    </div>
    <div class="form-item">
      <label class="required">检查项名称</label>
      <input type="text" id="edit-checkitem-name" value="${name}" style="width: 100%;">
    </div>
    <div class="form-item">
      <label class="required">分类</label>
      <input type="text" id="edit-checkitem-category" value="${category}" style="width: 100%;">
    </div>
    <div class="form-item">
      <label>描述</label>
      <textarea id="edit-checkitem-desc" style="width: 100%; min-height: 60px;">${description}</textarea>
    </div>
  `;

  const footer = `
    <div class="modal-footer">
      <button class="btn btn-default" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitEditCheckItem(${id})">保存</button>
    </div>
  `;

  showModal(content, { title: "编辑检查项", footer });
}

async function submitEditCheckItem(id) {
  const name = document.getElementById("edit-checkitem-name").value.trim();
  const category = document
    .getElementById("edit-checkitem-category")
    .value.trim();
  const description = document
    .getElementById("edit-checkitem-desc")
    .value.trim();

  if (!name || !category) {
    showToast("请填写完整信息", "error");
    return;
  }

  const res = await api.updateCheckItem(id, {
    name,
    category,
    description: description || null,
  });

  if (res.code !== 0) {
    showToast(res.message || "更新失败", "error");
    return;
  }

  showToast("更新成功");
  closeModal();
  renderChecklistsPage();
}

async function renderStatsPage() {
  const container = document.getElementById("page-container");

  const [
    overviewRes,
    vendorRes,
    itemRes,
    topRes,
    categoryRes,
    templateRes,
    versionRes,
    appealsRes,
    appealsVendorRes,
  ] = await Promise.all([
    api.getOverview(),
    api.getStatsByVendor(),
    api.getStatsByCheckItem(),
    api.getTopViolations(8),
    api.getStatsByCategory(),
    api.getStatsByTemplate(),
    api.getStatsByChecklistVersion(),
    api.getStatsAppeals(),
    api.getStatsAppealsByVendor(),
  ]);

  const overview = overviewRes.data;
  const vendors = vendorRes.data || [];
  const checkItems = itemRes.data || [];
  const topViolations = topRes.data || [];
  const categoryStats = categoryRes.data || [];
  const templateStats = templateRes.data || [];
  const versionStats = versionRes.data || [];
  const appealsStats = appealsRes.data || {};
  const appealsVendorStats = appealsVendorRes.data || [];

  const maxFailCount = Math.max(...checkItems.map((i) => i.fail_count), 1);
  const maxRejectRate = Math.max(...vendors.map((v) => v.reject_rate), 1);

  const appealAcceptRate =
    appealsStats.total > 0
      ? ((appealsStats.accepted / appealsStats.total) * 100).toFixed(1)
      : 0;

  container.innerHTML = `
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-card-value">${overview.total}</div>
        <div class="stat-card-label">总版本数</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-card-value">${overview.pending}</div>
        <div class="stat-card-label">待审</div>
      </div>
      <div class="stat-card primary">
        <div class="stat-card-value">${overview.reviewing}</div>
        <div class="stat-card-label">审核中</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-card-value">${overview.rejected}</div>
        <div class="stat-card-label">驳回</div>
      </div>
      <div class="stat-card success">
        <div class="stat-card-value">${overview.approved}</div>
        <div class="stat-card-label">已通过</div>
      </div>
      <div class="stat-card gray">
        <div class="stat-card-value">${overview.offShelf}</div>
        <div class="stat-card-label">已下架</div>
      </div>
      <div class="stat-card primary">
        <div class="stat-card-value">${appealsStats.total || 0}</div>
        <div class="stat-card-label">总申辩数</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-card-value">${appealsStats.pending || 0}</div>
        <div class="stat-card-label">待审核申辩</div>
      </div>
      <div class="stat-card success">
        <div class="stat-card-value">${appealsStats.accepted || 0}</div>
        <div class="stat-card-label">已采纳</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-card-value">${appealsStats.rejected || 0}</div>
        <div class="stat-card-label">已驳回</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-value">${appealAcceptRate}%</div>
        <div class="stat-card-label">申辩采纳率</div>
      </div>
    </div>

    <div class="card stat-section">
      <h3>🔥 高频违规项 TOP 8</h3>
      <div class="bar-chart">
        ${
          topViolations.length === 0
            ? '<div class="empty">暂无数据</div>'
            : topViolations
                .map(
                  (item) => `
          <div class="bar-item">
            <span class="bar-label" title="${item.name}">${item.name}</span>
            <div class="bar-track">
              <div class="bar-fill danger" style="width: ${(item.fail_count / (topViolations[0]?.fail_count || 1)) * 100}%"></div>
            </div>
            <span class="bar-value">${item.fail_count} 次</span>
          </div>
        `,
                )
                .join("")
        }
      </div>
    </div>

    <div class="card stat-section">
      <h3>📊 各检查项不通过率</h3>
      <div class="bar-chart">
        ${
          checkItems.length === 0
            ? '<div class="empty">暂无数据</div>'
            : checkItems
                .map(
                  (item) => `
          <div class="bar-item">
            <span class="bar-label" title="${item.name}">${item.name}</span>
            <div class="bar-track">
              <div class="bar-fill ${item.fail_rate > 50 ? "danger" : ""}" style="width: ${item.fail_rate}%"></div>
            </div>
            <span class="bar-value">${item.fail_rate}%</span>
          </div>
        `,
                )
                .join("")
        }
      </div>
    </div>

    <div class="card stat-section">
      <h3>🏭 各厂商驳回率统计</h3>
      <table>
        <thead>
          <tr>
            <th>厂商</th>
            <th>提交版本数</th>
            <th>通过数</th>
            <th>驳回数</th>
            <th>累计驳回次数</th>
            <th>驳回率</th>
          </tr>
        </thead>
        <tbody>
          ${
            vendors.length === 0
              ? '<tr><td colspan="6" class="empty">暂无数据</td></tr>'
              : vendors
                  .map(
                    (v) => `
            <tr>
              <td><strong>${v.vendor}</strong></td>
              <td>${v.total_versions}</td>
              <td>${v.approved_count}</td>
              <td>${v.rejected_count}</td>
              <td>${v.total_rejects || 0}</td>
              <td>
                <span class="status-tag ${v.reject_rate > 50 ? "status-rejected" : v.reject_rate > 20 ? "status-pending" : "status-approved"}">
                  ${v.reject_rate}%
                </span>
              </td>
            </tr>
          `,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>

    <div class="card stat-section">
      <h3>📁 按应用类别统计</h3>
      <table>
        <thead>
          <tr>
            <th>类别</th>
            <th>提交版本数</th>
            <th>通过数</th>
            <th>驳回数</th>
            <th>审核中</th>
            <th>待审核</th>
            <th>通过率</th>
          </tr>
        </thead>
        <tbody>
          ${
            categoryStats.length === 0
              ? '<tr><td colspan="7" class="empty">暂无数据</td></tr>'
              : categoryStats
                  .map(
                    (c) => `
            <tr>
              <td><strong>${c.category_name || "未分类"}</strong></td>
              <td>${c.total}</td>
              <td>${c.approved}</td>
              <td>${c.rejected}</td>
              <td>${c.reviewing}</td>
              <td>${c.pending}</td>
              <td>
                <span class="status-tag ${c.pass_rate > 80 ? "status-approved" : c.pass_rate > 50 ? "status-pending" : "status-rejected"}">
                  ${c.pass_rate}%
                </span>
              </td>
            </tr>
          `,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>

    <div class="card stat-section">
      <h3>📋 按清单模板统计</h3>
      <table>
        <thead>
          <tr>
            <th>模板名称</th>
            <th>版本数</th>
            <th>通过数</th>
            <th>驳回数</th>
            <th>关联类别</th>
            <th>最新版本</th>
            <th>通过率</th>
          </tr>
        </thead>
        <tbody>
          ${
            templateStats.length === 0
              ? '<tr><td colspan="7" class="empty">暂无数据</td></tr>'
              : templateStats
                  .map(
                    (t) => `
            <tr>
              <td><strong>${t.template_name}</strong></td>
              <td>${t.total}</td>
              <td>${t.approved}</td>
              <td>${t.rejected}</td>
              <td>${t.category_count || 0} 个</td>
              <td>v${t.latest_version || "-"}</td>
              <td>
                <span class="status-tag ${t.pass_rate > 80 ? "status-approved" : t.pass_rate > 50 ? "status-pending" : "status-rejected"}">
                  ${t.pass_rate}%
                </span>
              </td>
            </tr>
          `,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>

    <div class="card stat-section">
      <h3>🔒 按清单版本统计（追溯）</h3>
      <table>
        <thead>
          <tr>
            <th>清单版本</th>
            <th>模板</th>
            <th>版本号</th>
            <th>检查项数</th>
            <th>使用次数</th>
            <th>通过数</th>
            <th>驳回数</th>
            <th>发布时间</th>
          </tr>
        </thead>
        <tbody>
          ${
            versionStats.length === 0
              ? '<tr><td colspan="8" class="empty">暂无数据</td></tr>'
              : versionStats
                  .map(
                    (v) => `
            <tr>
              <td><strong>#${v.version_id}</strong></td>
              <td>${v.template_name}</td>
              <td>v${v.version_number}</td>
              <td>${v.item_count}</td>
              <td>${v.total}</td>
              <td>${v.approved}</td>
              <td>${v.rejected}</td>
              <td>${new Date(v.created_at).toLocaleString()}</td>
            </tr>
          `,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>

    <div class="card stat-section">
      <h3>⚖️ 各厂商申辩统计</h3>
      <table>
        <thead>
          <tr>
            <th>厂商</th>
            <th>申辩总数</th>
            <th>待审核</th>
            <th>已采纳</th>
            <th>已驳回</th>
            <th>采纳率</th>
          </tr>
        </thead>
        <tbody>
          ${
            appealsVendorStats.length === 0
              ? '<tr><td colspan="6" class="empty">暂无数据</td></tr>'
              : appealsVendorStats
                  .map(
                    (v) => `
            <tr>
              <td><strong>${v.vendor}</strong></td>
              <td>${v.total}</td>
              <td>${v.pending}</td>
              <td>${v.accepted}</td>
              <td>${v.rejected}</td>
              <td>
                <span class="status-tag ${v.accept_rate > 50 ? "status-approved" : v.accept_rate > 20 ? "status-pending" : "status-rejected"}">
                  ${v.accept_rate}%
                </span>
              </td>
            </tr>
          `,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });

  navigateTo("versions");
});
