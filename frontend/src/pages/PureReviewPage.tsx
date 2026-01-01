import {
  CloseOutlined,
  LeftOutlined,
  MoonOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  SettingOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { Button, ConfigProvider, Space, Spin, Typography, message, theme } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import QACardUnified from '../components/QACardUnified'
import SettingsModal from '../components/SettingsModal'
import { datasetsApi, itemsApi } from '../services/api'
import { useSettingsStore } from '../stores/settingsStore'

const { Title, Text } = Typography

/**
 * 纯净审核页面（重构版）
 * - 使用QACardUnified组件
 * - 展示和编辑一体化
 * - 支持多轮对话
 * - 支持多模态图片
 * - inline diff显示变更
 */
export default function PureReviewPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dataset, setDataset] = useState<any>(null)
  const [currentItem, setCurrentItem] = useState<any>(null)
  const [currentIndex, setCurrentIndex] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 编辑状态
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<any>(null)

  const { theme: appTheme, toggleTheme, hotkeys } = useSettingsStore()
  const isDark = appTheme === 'dark'

  // 获取数据集信息
  useEffect(() => {
    if (datasetId) {
      datasetsApi.get(parseInt(datasetId)).then((res) => setDataset(res.data))
    }
  }, [datasetId])

  // 获取语料
  const fetchItem = useCallback(
    async (index: number) => {
      if (!datasetId) return
      setLoading(true)
      try {
        const res = await itemsApi.list(parseInt(datasetId), index, 1)
        const { items, total } = res.data
        setTotalItems(total)
        if (items.length > 0) {
          setCurrentItem(items[0])
          setCurrentIndex(index)
          setEditingContent(items[0].current_content)
          setEditingField(null)
        }
      } catch (error) {
        message.error('获取语料失败')
      } finally {
        setLoading(false)
      }
    },
    [datasetId],
  )

  useEffect(() => {
    const seq = searchParams.get('seq')
    fetchItem(seq ? parseInt(seq) : 1)
  }, [datasetId, searchParams, fetchItem])

  // 导航
  const goPrev = () => {
    if (currentIndex > 1 && !editingField) fetchItem(currentIndex - 1)
  }

  const goNext = () => {
    if (currentIndex < totalItems && !editingField) fetchItem(currentIndex + 1)
  }

  // 开始编辑
  const startEdit = (field: string) => {
    setEditingField(field)
    // 深拷贝当前内容用于编辑
    setEditingContent(JSON.parse(JSON.stringify(currentItem.current_content)))
  }

  // 保存
  const handleSave = async () => {
    if (!currentItem) return
    setSaving(true)
    try {
      await itemsApi.update(currentItem.id, { current_content: editingContent })
      message.success('保存成功')
      setEditingField(null)
      fetchItem(currentIndex)
    } catch (error) {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 取消编辑
  const handleCancel = () => {
    setEditingField(null)
    setEditingContent(currentItem?.current_content)
  }

  // 通过
  const handleApprove = async () => {
    if (!currentItem || editingField) return
    setSaving(true)
    try {
      await itemsApi.approve(currentItem.id)
      message.success('已通过')
      goNext()
    } catch (error) {
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  // 拒绝
  const handleReject = async () => {
    if (!currentItem || editingField) return
    setSaving(true)
    try {
      await itemsApi.reject(currentItem.id)
      message.success('已拒绝')
      goNext()
    } catch (error) {
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  // 快捷键
  useHotkeys(hotkeys.prevItem, goPrev, { enabled: !editingField })
  useHotkeys(hotkeys.nextItem, goNext, { enabled: !editingField })
  useHotkeys(hotkeys.approve, handleApprove, { enabled: !editingField, preventDefault: true })
  useHotkeys(hotkeys.reject, handleReject, { enabled: !editingField, preventDefault: true })
  useHotkeys(hotkeys.focusQ, () => startEdit('q_0'), {
    enabled: !editingField,
    preventDefault: true,
  })
  useHotkeys(hotkeys.focusA, () => startEdit('a_0'), {
    enabled: !editingField,
    preventDefault: true,
  })
  useHotkeys(hotkeys.save, handleSave, { enabled: !!editingField, preventDefault: true })
  useHotkeys(hotkeys.cancel, handleCancel, { enabled: !!editingField })

  // 主题配置
  const themeConfig = isDark
    ? { algorithm: theme.darkAlgorithm, token: { colorPrimary: '#1890ff' } }
    : { algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#1890ff' } }

  return (
    <ConfigProvider theme={themeConfig}>
      <div
        style={{
          minHeight: '100vh',
          background: isDark ? '#141414' : '#f5f5f5',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 顶部栏 */}
        <div
          style={{
            height: 56,
            background: isDark ? '#1f1f1f' : '#fff',
            borderBottom: isDark ? '1px solid #434343' : '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
          }}
        >
          <Space>
            <Button type="text" icon={<CloseOutlined />} onClick={() => navigate('/tasks')} />
            <Title level={5} style={{ margin: 0, color: isDark ? '#e8e8e8' : '#333' }}>
              {dataset?.name || '加载中...'}
            </Title>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {currentIndex} / {totalItems}
            </Text>
            {currentItem?.status && (
              <Text
                type={
                  currentItem.status === 'approved'
                    ? 'success'
                    : currentItem.status === 'rejected'
                      ? 'danger'
                      : 'secondary'
                }
                style={{ marginLeft: 8 }}
              >
                [
                {currentItem.status === 'approved'
                  ? '已通过'
                  : currentItem.status === 'rejected'
                    ? '已拒绝'
                    : '待审核'}
                ]
              </Text>
            )}
          </Space>

          <Space>
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
            />
            <Button type="text" icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)} />
            <Button
              type="text"
              icon={<QuestionCircleOutlined />}
              onClick={() => message.info('按 q 编辑问题，按 a 编辑回答，PageUp/PageDown 翻页')}
            />
          </Space>
        </div>

        {/* 内容区域 */}
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          <Spin spinning={loading}>
            {currentItem && (
              <QACardUnified
                originalContent={currentItem.original_content}
                currentContent={editingField ? editingContent : currentItem.current_content}
                seqNum={currentItem.seq_num}
                theme={appTheme}
                fieldMapping={dataset?.field_mapping}
                editingField={editingField}
                onStartEdit={startEdit}
                onContentChange={setEditingContent}
                onSave={handleSave}
                onCancel={handleCancel}
              />
            )}
          </Spin>
        </div>

        {/* 底部操作栏 */}
        <div
          style={{
            height: 64,
            background: isDark ? '#1f1f1f' : '#fff',
            borderTop: isDark ? '1px solid #434343' : '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
          }}
        >
          {/* 左侧：导航 */}
          <Space>
            <Button
              icon={<LeftOutlined />}
              onClick={goPrev}
              disabled={currentIndex <= 1 || !!editingField}
            >
              上一条
            </Button>
            <Text style={{ margin: '0 12px', color: isDark ? '#e8e8e8' : '#333' }}>
              <strong>{currentIndex}</strong> / {totalItems}
            </Text>
            <Button
              icon={<RightOutlined />}
              onClick={goNext}
              disabled={currentIndex >= totalItems || !!editingField}
            >
              下一条
            </Button>
          </Space>

          {/* 右侧：操作按钮 */}
          <Space>
            {editingField ? (
              <>
                <Button onClick={handleCancel}>取消 (Esc)</Button>
                <Button type="primary" onClick={handleSave} loading={saving}>
                  保存 (Ctrl+S)
                </Button>
              </>
            ) : (
              <>
                <Button type="primary" danger onClick={handleReject} loading={saving}>
                  拒绝 (Ctrl+Shift+Enter)
                </Button>
                <Button type="primary" onClick={handleApprove} loading={saving}>
                  通过 (Ctrl+Enter)
                </Button>
              </>
            )}
          </Space>
        </div>

        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </ConfigProvider>
  )
}
