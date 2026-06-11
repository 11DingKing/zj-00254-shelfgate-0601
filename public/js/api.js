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

  getCheckItems: () => apiRequest("/reviews/check-items"),

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

  getOverview: () => apiRequest("/stats/overview"),

  getStatsByVendor: () => apiRequest("/stats/by-vendor"),

  getStatsByCheckItem: () => apiRequest("/stats/by-check-item"),

  getTopViolations: (limit = 5) =>
    apiRequest(`/stats/top-violations?limit=${limit}`),
};
