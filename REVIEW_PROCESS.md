# 上架审核流程说明

## 一、系统概览

本系统是一套应用上架合规审核平台，核心逻辑是：**厂商提交版本 → 审核员对照合规检查清单逐项审核 → 一项不通过即驳回整个版本 → 厂商整改后重新提交再走新一轮审核 → 已上架版本可因举报核实被强制下架**。

系统还支持厂商对单项不通过结果提出申辩，申辩采纳后可翻转审核结果。

---

## 二、核心数据模型

### 2.1 数据表关系总览

```
app_categories (应用类别)
    │
    ├── category_template_mapping ──→ checklist_templates (清单模板)
    │                                      │
    │                                      ├── template_item_mapping ──→ check_items (检查项库)
    │                                      │
    │                                      └── checklist_versions (清单版本，快照)
    │                                               │
    │                                               └── checklist_version_items (版本快照明细)
    │
    └── app_versions (应用版本)
             │
             ├── review_records (审核记录，每轮一条)
             │        │
             │        ├── checklist_version_id ──→ checklist_versions (本轮使用的清单版本)
             │        │
             │        └── review_item_results (逐项审核结果)
             │                 │
             │                 └── appeals (申辩记录)
             │
             └── shelf_status / shelf_off_reason / shelf_off_time (下架信息)
```

### 2.2 关键表字段说明

| 表名 | 关键字段 | 含义 |
|------|---------|------|
| `app_versions` | `status` | 版本审核状态：`pending` / `reviewing` / `rejected` / `approved` |
| `app_versions` | `reject_count` | 累计被驳回次数（每驳回一次 +1，重新提交不重置） |
| `app_versions` | `shelf_status` | 上架状态：`normal` / `off_shelf` |
| `app_versions` | `shelf_off_reason` | 下架原因 |
| `app_versions` | `shelf_off_time` | 下架时间 |
| `review_records` | `review_round` | 审核轮次，= 该版本的 `reject_count + 1` |
| `review_records` | `checklist_version_id` | 本轮审核使用的清单版本 |
| `review_records` | `result` | 本轮审核结论：`approved` / `rejected` |
| `review_records` | `reject_reason` | 驳回总体原因 |
| `review_item_results` | `result` | 单项审核结果：`pass` / `fail` |
| `review_item_results` | `has_appeal` | 是否已申辩 |
| `review_item_results` | `appeal_result` | 申辩结论：`accepted` / `rejected` |
| `appeals` | `status` | 申辩处理状态：`pending` / `reviewed` |
| `appeals` | `review_result` | 申辩审核结论：`accepted` / `rejected` |

---

## 三、版本状态流转

### 3.1 状态定义

| 状态值 | 中文名 | 含义 |
|--------|-------|------|
| `pending` | 待审 | 版本已提交，等待审核员开始审核 |
| `reviewing` | 审核中 | 审核员已开始本轮审核，正在逐项打勾 |
| `rejected` | 驳回 | 本轮审核存在不通过项，整个版本被驳回 |
| `approved` | 通过上架 | 所有检查项均通过，版本已上架 |

上架状态（独立于审核状态）：

| 状态值 | 中文名 | 含义 |
|--------|-------|------|
| `normal` | 正常上架 | 版本正常在架 |
| `off_shelf` | 已下架 | 因举报核实被强制下架 |

### 3.2 状态流转图

```
                        ┌─────────────┐
                        │   pending   │ ◄──────────────────────────────────┐
                        │    (待审)    │                                    │
                        └──────┬──────┘                                    │
                               │ 审核员点击「开始审核」                        │
                               │ (创建 review_records,                     │
                               │  review_round = reject_count + 1)        │
                               ▼                                           │
                        ┌─────────────┐                                    │
                  ┌────►│  reviewing  │                                    │
                  │     │   (审核中)   │                                    │
                  │     └──────┬──────┘                                    │
                  │            │                                           │
                  │     ┌──────┴──────┐                                    │
                  │     │ 逐项打勾提交  │                                    │
                  │     └──────┬──────┘                                    │
                  │            │                                           │
                  │     ┌──────┴──────────────────┐                        │
                  │     │                         │                        │
                  │     ▼                         ▼                        │
                  │  全部通过                   任一不通过                   │
                  │     │                         │                        │
                  │     ▼                         ▼                        │
                  │ ┌──────────┐           ┌──────────┐                   │
                  │ │ approved │           │ rejected │                   │
                  │ │(通过上架) │           │  (驳回)   │                   │
                  │ └────┬─────┘           └────┬─────┘                   │
                  │      │                      │                         │
                  │      │                      │ 厂商点击「重新提交」       │
                  │      │                      │ (status→pending,        │
                  │      │                      │  submit_time=now)       │
                  │      │                      └─────────────────────────┘
                  │      │
                  │      │ 举报核实后强制下架
                  │      ▼
                  │ ┌──────────┐
                  │ │ off_shelf│
                  │ │ (已下架)  │
                  │ └──────────┘
                  │
                  │ 申辩采纳后翻转
                  │ (所有fail项的申辩均被accepted)
                  └──────────────────→ approved
```

### 3.3 状态流转规则详解

| 起始状态 | 操作 | 目标状态 | 前置条件 | 代码位置 |
|---------|------|---------|---------|---------|
| - | 提交新版本 | `pending` | 应用名+版本号+厂商 唯一 | `POST /api/versions` |
| `pending` | 开始审核 | `reviewing` | 无未完成的审核记录 | `POST /api/reviews/start/:id` |
| `reviewing` | 提交审核结果(全通过) | `approved` | 所有检查项已审核 | `POST /api/reviews/submit/:id` |
| `reviewing` | 提交审核结果(有fail) | `rejected` | 所有检查项已审核 | `POST /api/reviews/submit/:id` |
| `rejected` | 厂商重新提交 | `pending` | 仅 `rejected` 状态可操作 | `POST /api/reviews/re-submit/:id` |
| `approved` | 强制下架 | `off_shelf`(shelf_status) | 仅 `approved`+`normal` 可操作 | `POST /api/reviews/off-shelf/:id` |
| `rejected` | 申辩全部采纳 | `approved` | 该轮所有fail项申辩均accepted | `POST /api/appeals/review/:id` |

---

## 四、合规检查清单机制

### 4.1 检查项层级结构

```
检查项库 (check_items)
  └── 归属模板 (checklist_templates, 通过 template_item_mapping 关联)
        └── 发布版本 (checklist_versions, 含 checklist_version_items 快照)
              └── 绑定到应用类别 (category_template_mapping)
```

### 4.2 检查项分类

当前系统内置 8 项合规检查项，分为 3 大类：

**开屏广告类：**

| 编码 | 名称 | 说明 |
|------|------|------|
| `splash_close_visible` | 开屏关闭按钮清晰可见 | 关闭按钮不能与背景融为一体 |
| `splash_close_area` | 关闭热区大小合规 | 热区不能过小，保证容易点击 |
| `fullscreen_click_jump` | 无全屏可点跳转 | 不能整个页面都可点击跳转 |
| `fake_close_button` | 无虚假关闭按钮 | 点击后不能反而跳转 |
| `countdown_display` | 倒计时清晰展示 | 让用户知道等待时间 |

**交互行为类：**

| 编码 | 名称 | 说明 |
|------|------|------|
| `shake_trigger` | 无摇一摇误触 | 不能用摇一摇等易误触方式触发跳转 |

**跳转行为类：**

| 编码 | 名称 | 说明 |
|------|------|------|
| `jump_notification` | 跳转前明确告知 | 跳转第三方前必须明确告知用户 |
| `auto_redirect` | 无自动跳转 | 不能未经用户同意自动跳转 |

### 4.3 清单版本快照机制

清单模板发布版本时会生成**快照**：

1. 创建 `checklist_versions` 记录，`is_locked = 1`（锁定不可修改）
2. 将当前模板包含的检查项**复制**到 `checklist_version_items`（含 code/name/description/category 的快照副本）
3. 后续修改模板或检查项不影响已发布的清单版本

**为什么需要快照？** 保证审核时使用的清单内容和审核后保持一致，避免"规则变了但历史审核记录对不上"的问题。

### 4.4 审核时清单版本的选取逻辑

审核员点击「开始审核」时，系统自动绑定清单版本，选取规则：

```
1. 如果该版本所属类别已配置模板映射
   → 取该模板下最新已锁定(is_locked=1)的清单版本

2. 如果未配置类别或无可用清单版本
   → checklist_version_id = null
   → 审核时使用 check_items 表中的活跃检查项作为兜底
```

参见代码：[reviews.js](file:///Users/huangding/Documents/SOLOCODE%203/0612/mbp/zj-00254-shelfgate-5/server/routes/reviews.js#L209-L227)

---

## 五、审核逐项打勾流程

### 5.1 审核提交的严格校验

审核员提交审核结果时，系统执行以下校验（参见 [reviews.js](file:///Users/huangding/Documents/SOLOCODE%203/0612/mbp/zj-00254-shelfgate-5/server/routes/reviews.js#L257-L425)）：

```
1. 版本状态必须是 reviewing
2. 必须有未完成的审核记录（end_time IS NULL）
3. 审核轮次必须匹配：review_round = reject_count + 1
4. 必须提交所有检查项的结果（不允许遗漏）
5. 每项结果值必须是 pass 或 fail
6. 检查项 ID 必须在清单范围内
```

### 5.2 一票否决规则

```
任一检查项 result = 'fail'
    → 整轮审核结果 result = 'rejected'
    → 版本状态 status = 'rejected'
    → 版本 reject_count += 1

全部检查项 result = 'pass'
    → 整轮审核结果 result = 'approved'
    → 版本状态 status = 'approved'
    → 版本 shelf_status = 'normal'
```

### 5.3 审核结果数据记录

每次审核提交会写入：

- `review_records` 表：一条记录（含轮次、审核员、清单版本、结论、驳回原因）
- `review_item_results` 表：N 条记录（每个检查项一条，含 pass/fail、审核员备注）
- 如果关联了清单版本，每条还会记录 `checklist_version_item_id`（快照项 ID）

---

## 六、多轮重审机制

### 6.1 核心概念

- **`reject_count`**：版本级别的累计驳回次数，每驳回一次 +1，**重新提交不会清零**
- **`review_round`**：审核记录级别的轮次号，= `reject_count + 1`（开始审核时计算）
- 每轮审核产生一条独立的 `review_records` 记录和一组 `review_item_results`

### 6.2 多轮重审完整流程

以种子数据「每日头条 v3.8.1」为例（参见 [schema.js](file:///Users/huangding/Documents/SOLOCODE%203/0612/mbp/zj-00254-shelfgate-5/server/db/schema.js#L488-L617)）：

```
第1轮：
  厂商提交 → status=pending, reject_count=0
  开始审核 → review_round=1, 绑定「通用合规清单 v1.0.0」
  逐项打勾 → 第3项「无全屏可点跳转」fail，其余 pass
  提交结果 → status=rejected, reject_count=1
              reject_reason="存在全屏点击跳转问题"

第2轮：
  厂商整改后重新提交 → status=pending (reject_count 仍为 1)
  开始审核 → review_round=2, 绑定「通用合规清单 v1.0.0」
  逐项打勾 → 第3项仍 fail，第7项「无虚假关闭按钮」新增 fail
  提交结果 → status=rejected, reject_count=2
              reject_reason="全屏点击问题未修复，新增虚假关闭按钮问题"

（等待厂商再次整改...）

第N轮：
  厂商重新提交 → status=pending (reject_count 仍为 2)
  开始审核 → review_round=3
  全部通过 → status=approved, reject_count 不再增加
```

### 6.3 重新提交做了什么

参见 [reviews.js](file:///Users/huangding/Documents/SOLOCODE%203/0612/mbp/zj-00254-shelfgate-5/server/routes/reviews.js#L464-L490)：

```sql
UPDATE app_versions 
SET status = 'pending', 
    submit_time = CURRENT_TIMESTAMP, 
    review_start_time = NULL, 
    review_end_time = NULL
WHERE id = ?
```

注意：`reject_count` **不会被清零**，它保留历史累计值，用于计算下一轮的 `review_round`。

### 6.4 查看版本被驳回过几次

方式一：直接读 `app_versions.reject_count`

方式二：统计 `review_records` 中 `result = 'rejected'` 的记录数

系统启动时会通过 `fixDataConsistency()` 函数自动校验并修复两者不一致的情况（参见 [schema.js](file:///Users/huangding/Documents/SOLOCODE%203/0612/mbp/zj-00254-shelfgate-5/server/db/schema.js#L756-L836)）。

### 6.5 查看每轮卡在哪些检查项

通过 `review_records` 关联 `review_item_results` 即可还原每轮的审核细节：

```sql
SELECT rr.review_round, rr.result, rr.reject_reason,
       ci.name, rir.result AS item_result, rir.comment
FROM review_records rr
JOIN review_item_results rir ON rir.record_id = rr.id
JOIN check_items ci ON rir.check_item_id = ci.id
WHERE rr.version_id = ?
ORDER BY rr.review_round, ci.sort_order
```

---

## 七、强制下架机制

### 7.1 下架条件

- 版本审核状态必须是 `approved`（只有已上架的才能下架）
- 当前上架状态必须是 `normal`（不能重复下架）
- 必须填写下架原因

### 7.2 下架操作

参见 [reviews.js](file:///Users/huangding/Documents/SOLOCODE%203/0612/mbp/zj-00254-shelfgate-5/server/routes/reviews.js#L427-L462)：

```sql
UPDATE app_versions 
SET shelf_status = 'off_shelf', 
    shelf_off_reason = ?, 
    shelf_off_time = CURRENT_TIMESTAMP
WHERE id = ?
```

注意：下架只改 `shelf_status`，不改 `status`（`status` 仍为 `approved`）。也就是说，版本在审核维度上仍是"通过"的，但在上架维度上已被移除。

### 7.3 种子数据示例

「趣购优选 v4.0.0」经历了完整流程：提交 → 驳回 → 重新提交 → 通过 → 被举报强制下架

```
提交 → 第1轮审核 → 驳回(跳转前未告知) 
     → 厂商重新提交 → 第2轮审核 → 通过
     → 举报核实 → 强制下架(诱导点击跳转)
```

---

## 八、申辩机制

### 8.1 申辩条件

- 只能对 `result = 'fail'` 的审核项提出申辩
- 版本状态必须为 `rejected`
- 同一审核项只能申辩一次（`has_appeal` 标记）

### 8.2 申辩审核结果

| 申辩结果 | 说明 |
|---------|------|
| `accepted` | 采纳申辩，该项 fail 结果被覆盖 |
| `rejected` | 维持原判 |

### 8.3 申辩采纳的连锁效应

当某个 fail 项的申辩被采纳时，系统会检查该轮审核中**是否还有未翻转的 fail 项**：

```sql
SELECT COUNT(*) FROM review_item_results 
WHERE record_id = ? 
  AND result = 'fail' 
  AND (appeal_result IS NULL OR appeal_result != 'accepted')
```

- 如果**所有 fail 项的申辩均被采纳**（计数 = 0）：
  - 该轮 `review_records.result` 从 `rejected` → `approved`
  - 版本 `app_versions.status` 从 `rejected` → `approved`

- 如果**仍有未翻转的 fail 项**：仅修改该项的 `appeal_result`，版本状态不变

参见代码：[appeals.js](file:///Users/huangding/Documents/SOLOCODE%203/0612/mbp/zj-00254-shelfgate-5/server/routes/appeals.js#L243-L294)

---

## 九、完整生命周期示意

```
厂商操作                    系统状态                     审核员操作
────────                   ────────                    ──────────

提交版本 ──────────→ pending
                              │
                              ├──→ 开始审核 ──→ reviewing
                              │                    │
                              │              逐项打勾提交 ──→ 全pass?
                              │                    │           │
                              │                    │     ┌─────┴─────┐
                              │                    │     Yes        No
                              │                    │     │          │
                              │                    │     ▼          ▼
                              │                    │  approved   rejected
                              │                    │              │
                              │                    │         ┌────┴────┐
                              │                    │         │         │
                              │                    │         │    厂商申辩?
                              │                    │         │    ├─ Yes → 申辩审核
                              │                    │         │    │  ├─ 全采纳 → approved
                              │                    │         │    │  └─ 未全采纳 → 保持rejected
                              │                    │         │    │
                              │                    │         │    └─ No
                              │                    │         │         │
  重新提交 ◄──────────────────┘                    │         │         │
     │                                             │         │         │
     └──────────────────→ pending ──→ reviewing ──┘         │         │
                                       │                     │         │
                                       └──→ ... (循环)        │         │
                                                              │         │
                                                          approved    rejected
                                                              │
                                                    举报核实?  │
                                                    ├─ Yes → off_shelf
                                                    └─ No  → 保持 normal
```

---

## 十、API 速查

| 操作 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 提交新版本 | POST | `/api/versions` | status 初始为 pending |
| 查看版本详情 | GET | `/api/versions/:id` | 含所有轮次审核记录 |
| 开始审核 | POST | `/api/reviews/start/:id` | pending → reviewing |
| 提交审核结果 | POST | `/api/reviews/submit/:id` | reviewing → approved/rejected |
| 重新提交 | POST | `/api/reviews/re-submit/:id` | rejected → pending |
| 强制下架 | POST | `/api/reviews/off-shelf/:id` | shelf_status → off_shelf |
| 提交申辩 | POST | `/api/appeals` | 对 fail 项申辩 |
| 审核申辩 | POST | `/api/appeals/review/:id` | accepted 可能翻转版本状态 |
