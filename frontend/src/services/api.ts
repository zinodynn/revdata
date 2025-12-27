import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

// 请求拦截器 - 添加token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// Auth API
export const authApi = {
  login: (username: string, password: string) => {
    const params = new URLSearchParams()
    params.append('username', username)
    params.append('password', password)
    return api.post('/auth/login', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  },
  register: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
}

// Datasets API
export const datasetsApi = {
  list: (page = 1, pageSize = 20) =>
    api.get('/datasets', { params: { page, page_size: pageSize } }),
  get: (id: number) => api.get(`/datasets/${id}`),
  upload: (file: File, name: string, description?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)
    if (description) formData.append('description', description)
    return api.post('/datasets/upload', formData)
  },
}

// Items API
export const itemsApi = {
  list: (datasetId: number, page = 1, pageSize = 20, statusFilter?: string) =>
    api.get(`/items/dataset/${datasetId}`, {
      params: { page, page_size: pageSize, status_filter: statusFilter },
    }),
  get: (id: number) => api.get(`/items/${id}`),
  getBySeq: (datasetId: number, seqNum: number) =>
    api.get(`/items/dataset/${datasetId}/seq/${seqNum}`),
  update: (id: number, data: { current_content: any; status?: string; comment?: string }) =>
    api.put(`/items/${id}`, data),
  approve: (id: number) => api.post(`/items/${id}/approve`),
  reject: (id: number) => api.post(`/items/${id}/reject`),
}

// Tasks API
export const tasksApi = {
  myTasks: (statusFilter?: string) =>
    api.get('/tasks/my', { params: { status_filter: statusFilter } }),
  get: (id: number) => api.get(`/tasks/${id}`),
  create: (data: any) => api.post('/tasks', data),
  delegate: (id: number, data: { new_assignee_id: number; note?: string }) =>
    api.post(`/tasks/${id}/delegate`, data),
  complete: (id: number) => api.post(`/tasks/${id}/complete`),
  getUsers: () => api.get('/tasks/users/list'),
  delegationHistory: (taskId: number) => api.get(`/tasks/${taskId}/delegation-history`),
}

// Share API
export const shareApi = {
  create: (data: { dataset_id: number; permission: string; expires_at?: string; max_access_count?: number }) =>
    api.post('/share', data),
  list: (datasetId: number) => api.get(`/share/dataset/${datasetId}`),
  validate: (token: string) => api.get(`/share/${token}/validate`),
  access: (token: string) => api.post(`/share/${token}/access`),
  delete: (id: number) => api.delete(`/share/${id}`),
}

// Export API
export const exportApi = {
  download: (datasetId: number, options: { format: string; status_filter?: string; include_original?: boolean }) =>
    api.get(`/export/${datasetId}`, {
      params: options,
      responseType: 'blob',
    }),
}
