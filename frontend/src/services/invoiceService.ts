import api from './api';

export const invoiceService = {
  create: (data: any) => api.post('/invoices', data).then(r => r.data),
  getAll: () => api.get('/invoices').then(r => r.data),
  getById: (id: string) => api.get(`/invoices/${id}`).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/invoices/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/invoices/${id}`).then(r => r.data),
};

export const clientService = {
  create: (data: any) => api.post('/clients', data).then(r => r.data),
  getAll: () => api.get('/clients').then(r => r.data),
  getById: (id: string) => api.get(`/clients/${id}`).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/clients/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/clients/${id}`).then(r => r.data),
};

export const expenseService = {
  create: (data: any) => api.post('/expenses', data).then(r => r.data),
  getAll: () => api.get('/expenses').then(r => r.data),
  update: (id: string, data: any) => api.patch(`/expenses/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/expenses/${id}`).then(r => r.data),
};
