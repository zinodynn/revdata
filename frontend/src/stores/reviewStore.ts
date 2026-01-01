import { create } from 'zustand'

export interface DataItem {
  id: number
  dataset_id: number
  seq_num: number
  item_type: 'plain' | 'qa'
  original_content: any
  current_content: any
  status: 'pending' | 'approved' | 'rejected' | 'modified'
  has_changes: boolean
}

interface ReviewState {
  currentItem: DataItem | null
  currentIndex: number
  totalItems: number
  items: DataItem[]
  isEditing: boolean
  editingContent: any

  setCurrentItem: (item: DataItem) => void
  setItems: (items: DataItem[], total: number) => void
  setCurrentIndex: (index: number) => void
  setEditing: (editing: boolean) => void
  setEditingContent: (content: any) => void
  updateCurrentItem: (updates: Partial<DataItem>) => void
}

export const useReviewStore = create<ReviewState>((set) => ({
  currentItem: null,
  currentIndex: 0,
  totalItems: 0,
  items: [],
  isEditing: false,
  editingContent: null,

  setCurrentItem: (item) => set({ currentItem: item, editingContent: item.current_content }),
  setItems: (items, total) => set({ items, totalItems: total }),
  setCurrentIndex: (index) => set({ currentIndex: index }),
  setEditing: (editing) => set({ isEditing: editing }),
  setEditingContent: (content) => set({ editingContent: content }),
  updateCurrentItem: (updates) =>
    set((state) => ({
      currentItem: state.currentItem ? { ...state.currentItem, ...updates } : null,
    })),
}))
