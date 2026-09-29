import api from './api';

export const analyticsService = {
  getDashboard: (month?: string) =>
    api.get('/analytics/dashboard', { params: { month } }).then((r) => r.data),
  getCashFlow: () => api.get('/analytics/cashflow').then((r) => r.data),
  getExpenses: () => api.get('/analytics/expenses').then((r) => r.data),
  getAdvanced: () => api.get('/analytics/advanced').then((r) => r.data),
  getVisualizations: (params?: { timeframe?: string; startDate?: string; endDate?: string }) =>
    api.get('/analytics/visualizations', { params }).then((r) => r.data),
  getWhatIf: (params: any) =>
    api.get('/analytics/what-if', { params }).then((r) => r.data),
  getForecast: () => api.get('/analytics/forecast').then((r) => r.data),
  getHealthHistory: () => api.get('/analytics/health-history').then((r) => r.data),
};

export const goalsService = {
  getAll: () => api.get('/goals').then((r) => r.data),
  getSummary: () => api.get('/goals/summary').then((r) => r.data),
  create: (data: any) => api.post('/goals', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/goals/${id}`, data).then((r) => r.data),
  contribute: (id: string, amount: number) =>
    api.post(`/goals/${id}/contribute`, { amount }).then((r) => r.data),
  delete: (id: string) => api.delete(`/goals/${id}`).then((r) => r.data),
};

export const wealthService = {
  getAll: () => api.get('/wealth').then((r) => r.data),
  getSummary: () => api.get('/wealth/summary').then((r) => r.data),
  create: (data: any) => api.post('/wealth', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/wealth/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/wealth/${id}`).then((r) => r.data),
};

export const statementService = {
  importStatement: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    // Call AI service directly (proxied via /ai prefix or configured separately)
    return api.post('/statement/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  bulkImportExpenses: (transactions: any[]) =>
    api.post('/expenses/bulk', { transactions }).then((r) => r.data),
};
