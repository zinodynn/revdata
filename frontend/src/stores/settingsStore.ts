import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 默认快捷键配置
const defaultHotkeys = {
  nextItem: 'PageDown',
  prevItem: 'PageUp',
  approve: 'enter',
  reject: 'shift+enter',
  edit: 'ctrl+e',
  save: 'alt+s',
  cancel: 'escape',
  focusQ: 'q',
  focusA: 'a',
  jumpToNext: 'alt+n',
}

export type HotkeyConfig = typeof defaultHotkeys

interface SettingsState {
  // 主题
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void

  // 快捷键
  hotkeys: HotkeyConfig
  setHotkey: (action: keyof HotkeyConfig, key: string) => void
  resetHotkeys: () => void

  // 侧边栏
  siderCollapsed: boolean
  setSiderCollapsed: (collapsed: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // 主题
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),

      // 快捷键
      hotkeys: defaultHotkeys,
      setHotkey: (action, key) =>
        set((state) => ({
          hotkeys: { ...state.hotkeys, [action]: key },
        })),
      resetHotkeys: () => set({ hotkeys: defaultHotkeys }),

      // 侧边栏
      siderCollapsed: false,
      setSiderCollapsed: (collapsed) => set({ siderCollapsed: collapsed }),
    }),
    {
      name: 'settings-storage',
    },
  ),
)

// 快捷键名称映射
export const hotkeyLabels: Record<keyof HotkeyConfig, string> = {
  nextItem: '下一条',
  prevItem: '上一条',
  approve: '通过',
  reject: '拒绝',
  edit: '编辑',
  save: '保存',
  cancel: '取消编辑',
  focusQ: '编辑问题/用户/内容',
  focusA: '编辑答案/助手',
  jumpToNext: '跳转下一待审',
}
