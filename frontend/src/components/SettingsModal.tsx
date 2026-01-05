import { BulbOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button, Input, message, Modal, Space, Switch, Tabs, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { HotkeyConfig, hotkeyLabels, useSettingsStore } from '../stores/settingsStore'

const { Text } = Typography

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

// 快捷键输入组件
function HotkeyInput({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [isRecording, setIsRecording] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const parts: string[] = []
    if (e.ctrlKey) parts.push('ctrl')
    if (e.shiftKey) parts.push('shift')
    if (e.altKey) parts.push('alt')

    // 获取按键名称
    let key = e.key
    if (key === ' ') key = 'space'
    else if (key === 'Escape') key = 'escape'
    else if (key === 'Enter') key = 'enter'
    else if (key === 'PageUp') key = 'PageUp'
    else if (key === 'PageDown') key = 'PageDown'
    else if (key.length === 1) key = key.toLowerCase()

    // 排除纯修饰键
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      if (!parts.includes(key.toLowerCase())) {
        parts.push(key)
      }
      onChange(parts.join('+'))
      setIsRecording(false)
    }
  }

  const displayValue = value
    .split('+')
    .map((k) => {
      if (k === 'ctrl') return 'Ctrl'
      if (k === 'shift') return 'Shift'
      if (k === 'alt') return 'Alt'
      if (k === 'enter') return 'Enter'
      if (k === 'escape') return 'Escape'
      if (k === 'space') return 'Space'
      return k.charAt(0).toUpperCase() + k.slice(1)
    })
    .join(' + ')

  return (
    <Input
      ref={inputRef as any}
      value={isRecording ? '按下快捷键...' : displayValue}
      onFocus={() => setIsRecording(true)}
      onBlur={() => setIsRecording(false)}
      onKeyDown={handleKeyDown}
      readOnly
      style={{
        width: 150,
        textAlign: 'center',
        cursor: 'pointer',
        borderColor: isRecording ? '#1890ff' : undefined,
        background: isRecording ? '#e6f7ff' : undefined,
      }}
      placeholder="点击设置"
    />
  )
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { theme, setTheme, hotkeys, setHotkey, resetHotkeys } = useSettingsStore()
  const [localHotkeys, setLocalHotkeys] = useState<HotkeyConfig>(hotkeys)

  useEffect(() => {
    setLocalHotkeys(hotkeys)
  }, [hotkeys, open])

  const handleSave = () => {
    // 保存所有快捷键
    Object.entries(localHotkeys).forEach(([action, key]) => {
      setHotkey(action as keyof HotkeyConfig, key)
    })
    message.success('设置已保存')
    onClose()
  }

  const handleReset = () => {
    resetHotkeys()
    setLocalHotkeys({
      nextItem: 'PageDown',
      prevItem: 'PageUp',
      approve: 'ctrl+enter',
      reject: 'ctrl+shift+enter',
      edit: 'ctrl+e',
      save: 'alt+s',
      cancel: 'escape',
      focusQ: 'q',
      focusA: 'a',
      jumpToNext: 'ctrl+shift+n',
    })
    message.success('已恢复默认设置')
  }

  const tabItems = [
    {
      key: 'hotkeys',
      label: (
        <span>
          <ThunderboltOutlined /> 快捷键设置
        </span>
      ),
      children: (
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            点击快捷键按钮，然后按下您想要设置的键。特殊键如 PageUp、PageDown、Escape 等都可以使用。
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(Object.keys(localHotkeys) as Array<keyof HotkeyConfig>).map((action) => (
              <div
                key={action}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <span style={{ fontWeight: 500 }}>{hotkeyLabels[action]}</span>
                <HotkeyInput
                  value={localHotkeys[action]}
                  onChange={(key) => setLocalHotkeys((prev) => ({ ...prev, [action]: key }))}
                />
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'theme',
      label: (
        <span>
          <BulbOutlined /> 外观设置
        </span>
      ),
      children: (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 0',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            <div>
              <div style={{ fontWeight: 500 }}>深色模式</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                开启后使用深色护眼主题
              </Text>
            </div>
            <Switch
              checked={theme === 'dark'}
              onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              checkedChildren="🌙"
              unCheckedChildren="☀️"
            />
          </div>
        </div>
      ),
    },
  ]

  return (
    <Modal
      title={
        <>
          <SettingOutlined /> 快捷键设置
        </>
      }
      open={open}
      onCancel={onClose}
      width={500}
      footer={
        <Space>
          <Button onClick={handleReset}>恢复默认</Button>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            ✓ 保存设置
          </Button>
        </Space>
      }
    >
      <Tabs items={tabItems} defaultActiveKey="hotkeys" />
    </Modal>
  )
}
