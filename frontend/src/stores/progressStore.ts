import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProgressState {
  // 进度记录: { 'dataset_<id>': seq, 'task_<id>': seq }
  progress: Record<string, number>
  
  // 设置进度
  setProgress: (datasetId: string, taskId: string | null, index: number) => void
  
  // 获取进度
  getProgress: (datasetId: string, taskId: string | null) => number
  
  // 清除特定进度
  clearProgress: (datasetId: string, taskId?: string | null) => void
  
  // 清除所有进度
  clearAllProgress: () => void
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      progress: {},
      
      setProgress: (datasetId: string, taskId: string | null, index: number) => {
        const key = taskId ? `task_${taskId}` : `dataset_${datasetId}`
        set((state) => ({
          progress: { ...state.progress, [key]: index }
        }))
      },
      
      getProgress: (datasetId: string, taskId: string | null) => {
        const key = taskId ? `task_${taskId}` : `dataset_${datasetId}`
        return get().progress[key] || 1
      },
      
      clearProgress: (datasetId: string, taskId?: string | null) => {
        const key = taskId ? `task_${taskId}` : `dataset_${datasetId}`
        set((state) => {
          const newProgress = { ...state.progress }
          delete newProgress[key]
          return { progress: newProgress }
        })
      },
      
      clearAllProgress: () => {
        set({ progress: {} })
      },
    }),
    {
      name: 'progress-storage',
    }
  )
)
