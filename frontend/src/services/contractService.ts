import api from './api';

export const contractService = {
  async uploadAndAnalyze(file: File) {
    const formData = new FormData();
    formData.append('document', file);
    const res = await api.post('/contracts/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return res.data;
  },

  async analyzeTextAsContract(text: string, filename: string) {
    const blob = new Blob([text], { type: 'text/plain' });
    const file = new File([blob], filename, { type: 'text/plain' });
    return this.uploadAndAnalyze(file);
  },

  getAll: () => api.get('/contracts').then(r => r.data),
  getById: (id: string) => api.get(`/contracts/${id}`).then(r => r.data),
  deleteContract: (id: string) => api.post(`/contracts/${id}/delete`).then(r => r.data),

  askQuestion: (contractId: string, question: string, topK: number = 4, language: string = 'en') =>
    api.post(`/contracts/${contractId}/ask`, { question, top_k: topK, language }, { timeout: 60000 }).then(r => r.data),

  getQueries: (contractId: string) =>
    api.get(`/contracts/${contractId}/queries`).then(r => r.data),

  getLanguages: () =>
    api.get('/contracts/languages').then(r => r.data),

  translateContract: (contractData: any, targetLanguage: string) =>
    api.post('/contracts/translate', { contract_data: contractData, target_language: targetLanguage }, { timeout: 60000 }).then(r => r.data),
};
