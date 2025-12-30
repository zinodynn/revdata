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

// 无认证API实例 - 用于授权码等公开访问
const publicApi = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

// 公开API不自动跳转登录
publicApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
)

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
  update: (id: number, data: {
    name?: string
    description?: string
    field_mapping?: any
    review_config?: any
    status?: string
  }) => api.put(`/datasets/${id}`, data),
  upload: (file: File, name: string, description?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)
    if (description) formData.append('description', description)
    return api.post('/datasets/upload', formData)
  },
  preview: (id: number, count = 5) =>
    api.get(`/datasets/${id}/preview`, { params: { count } }),
  detectFields: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/datasets/detect-fields', formData)
  },
}

// Items API
export const itemsApi = {
  list: (datasetId: number, page = 1, pageSize = 20, statusFilter?: string, isMarked?: boolean) =>
    api.get(`/items/dataset/${datasetId}`, {
      params: { page, page_size: pageSize, status_filter: statusFilter, is_marked: isMarked },
    }),
  get: (id: number) => api.get(`/items/${id}`),
  getBySeq: (datasetId: number, seqNum: number) =>
    api.get(`/items/dataset/${datasetId}/seq/${seqNum}`),
  update: (id: number, data: { current_content: any; status?: string; comment?: string; is_marked?: boolean }) =>
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

// Users API (管理员)
export const usersApi = {
  list: () => api.get('/users'),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: { username: string; email: string; password: string; role: string }) =>
    api.post('/users', data),
  update: (id: number, data: { username?: string; email?: string; role?: string }) =>
    api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  resetPassword: (id: number) => api.post(`/users/${id}/reset-password`),
}

// Auth Code API (授权码) - 使用无认证API
export const authCodeApi = {
  create: (data: {
    dataset_id: number
    item_start: number
    item_end: number
    max_online?: number
    max_verify_count?: number
    expires_at?: string
  }) => api.post('/auth-codes', data),
  list: (datasetId: number) => api.get(`/auth-codes/dataset/${datasetId}`),
  verify: (code: string) => publicApi.post(`/auth-codes/${code}/verify`),
  revoke: (id: number) => api.delete(`/auth-codes/${id}`),
  getReviewedItems: (code: string) => api.get(`/auth-codes/${code}/reviewed`),
  leave: (sessionToken: string) => publicApi.post('/auth-codes/session/leave', null, {
    params: { session_token: sessionToken },
  }),
  recordReview: (code: string, data: { item_id: number; action: string; session_token?: string }) =>
    publicApi.post(`/auth-codes/${code}/record-review`, null, {
      params: data,
    }),
}

// 公开Items API - 用于授权码访问
export const publicItemsApi = {
  get: (id: number, sessionToken?: string) =>
    publicApi.get(`/items/${id}`, {
      params: sessionToken ? { session_token: sessionToken } : {},
    }),
  getBySeq: (datasetId: number, seqNum: number, sessionToken?: string) =>
    publicApi.get(`/items/dataset/${datasetId}/seq/${seqNum}`, {
      params: sessionToken ? { session_token: sessionToken } : {},
    }),
  update: (id: number, data: { current_content: any }, sessionToken?: string) =>
    publicApi.put(`/items/${id}`, data, {
      params: sessionToken ? { session_token: sessionToken } : {},
    }),
  approve: (id: number, sessionToken?: string) =>
    publicApi.post(`/items/${id}/approve`, null, {
      params: sessionToken ? { session_token: sessionToken } : {},
    }),
  reject: (id: number, sessionToken?: string) =>
    publicApi.post(`/items/${id}/reject`, null, {
      params: sessionToken ? { session_token: sessionToken } : {},
    }),
}
