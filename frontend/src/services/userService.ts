import api from './api';

export const userService = {
  getProfile: () => api.get('/users/profile').then(r => r.data),
  updateProfile: (data: any) => api.patch('/users/profile', data).then(r => r.data),
};
