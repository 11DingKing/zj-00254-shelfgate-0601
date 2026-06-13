const API_BASE = "/api";

async function apiRequest(url, options = {}) {
  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const res = await fetch(`${API_BASE}${url}`, {
    ...defaultOptions,
    ...options,
  });
  const data = await res.json();
  return data;
}

const api = {
  getVersions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/versions?${query}`);
  },

  getVersion: (id) => apiRequest(`/versions/${id}`),

  submitVersion: (data) =>
    apiRequest("/versions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getVendors: () => apiRequest("/versions/vendors/list"),

  getCategories: () => apiRequest("/checklists/categories"),

  createCategory: (data) =>
    apiRequest("/checklists/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCategory: (id, data) =>
    apiRequest(`/checklists/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getTemplates: (include_items = false) =>
    apiRequest(`/checklists/templates?include_items=${include_items}`),

  createTemplate: (data) =>
    apiRequest("/checklists/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTemplate: (id, data) =>
    apiRequest(`/checklists/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getTemplateItems: (templateId) =>
    apiRequest(`/checklists/templates/${templateId}/items`),

  getChecklistVersions: (template_id) => {
    const query = template_id ? `?template_id=${template_id}` : "";
    return apiRequest(`/checklists/versions${query}`);
  },

  getChecklistVersion: (id) => apiRequest(`/checklists/versions/${id}`),

  createChecklistVersion: (data) =>
    apiRequest("/checklists/versions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getCategoryTemplateMapping: () =>
    apiRequest("/checklists/category-template-mapping"),

  createCategoryTemplateMapping: (data) =>
    apiRequest("/checklists/category-template-mapping", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteCategoryTemplateMapping: (id) =>
    apiRequest(`/checklists/category-template-mapping/${id}`, {
      method: "DELETE",
    }),

  getAllCheckItems: (active_only = true) =>
    apiRequest(`/checklists/check-items?active_only=${active_only}`),

  createCheckItem: (data) =>
    apiRequest("/checklists/check-items", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCheckItem: (id, data) =>
    apiRequest(`/checklists/check-items/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getCheckItems: (version_id) => {
    const query = version_id ? `?version_id=${version_id}` : "";
    return apiRequest(`/reviews/check-items${query}`);
  },

  getReviewChecklistVersion: (versionId) =>
    apiRequest(`/reviews/checklist-version/${versionId}`),

  startReview: (versionId, reviewer) =>
    apiRequest(`/reviews/start/${versionId}`, {
      method: "POST",
      body: JSON.stringify({ reviewer }),
    }),

  submitReview: (versionId, data) =>
    apiRequest(`/reviews/submit/${versionId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  offShelf: (versionId, reason) =>
    apiRequest(`/reviews/off-shelf/${versionId}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  reSubmit: (versionId) =>
    apiRequest(`/reviews/re-submit/${versionId}`, {
      method: "POST",
    }),

  getAppeals: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/appeals?${query}`);
  },

  getAppeal: (id) => apiRequest(`/appeals/${id}`),

  submitAppeal: (data) =>
    apiRequest("/appeals", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  reviewAppeal: (id, data) =>
    apiRequest(`/appeals/review/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getAppealsByResult: (reviewItemResultId) =>
    apiRequest(`/appeals/by-result/${reviewItemResultId}`),

  getOverview: () => apiRequest("/stats/overview"),

  getStatsByVendor: () => apiRequest("/stats/by-vendor"),

  getStatsByCheckItem: () => apiRequest("/stats/by-check-item"),

  getTopViolations: (limit = 5) =>
    apiRequest(`/stats/top-violations?limit=${limit}`),

  getStatsByCategory: () => apiRequest("/stats/by-category"),

  getStatsByTemplate: () => apiRequest("/stats/by-template"),

  getStatsByChecklistVersion: () => apiRequest("/stats/by-checklist-version"),

  getStatsAppeals: () => apiRequest("/stats/appeals"),

  getStatsAppealsByVendor: () => apiRequest("/stats/appeals-by-vendor"),
};
