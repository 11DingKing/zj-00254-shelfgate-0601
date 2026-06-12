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
  const titleMap = { versions: "版本审核", stats: "数据统计" };
  document.getElementById("page-title").textContent = titleMap[page] || page;

  if (page === "versions") renderVersionsPage();
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
        ${record.reject_reason ? `<div class="reject-reason">驳回原因：${record.reject_reason}</div>` : ""}
        <div>
          ${record.items
            .map(
              (item) => `
            <div class="review-item">
              <span class="review-item-icon">${item.result === "pass" ? "✅" : "❌"}</span>
              <div class="review-item-content">
                <div class="review-item-name">${item.name}</div>
                ${item.comment ? `<div class="review-item-comment">${item.comment}</div>` : ""}
              </div>
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
    <div class="version-info">
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
    api.getCheckItems(),
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
        <span class="info-label">第 N 轮审核</span>
        <span class="info-value">第 ${version.reject_count + 1} 轮</span>
      </div>
    </div>

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

function showSubmitModal() {
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

  if (!appName || !versionNo || !vendor) {
    showToast("请填写完整信息", "error");
    return;
  }

  const res = await api.submitVersion({
    app_name: appName,
    version_no: versionNo,
    vendor,
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

async function renderStatsPage() {
  const container = document.getElementById("page-container");

  const [overviewRes, vendorRes, itemRes, topRes] = await Promise.all([
    api.getOverview(),
    api.getStatsByVendor(),
    api.getStatsByCheckItem(),
    api.getTopViolations(8),
  ]);

  const overview = overviewRes.data;
  const vendors = vendorRes.data || [];
  const checkItems = itemRes.data || [];
  const topViolations = topRes.data || [];

  const maxFailCount = Math.max(...checkItems.map((i) => i.fail_count), 1);
  const maxRejectRate = Math.max(...vendors.map((v) => v.reject_rate), 1);

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
