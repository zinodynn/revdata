import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  FastForwardOutlined,
  FlagOutlined,
  LeftOutlined,
  RightOutlined,
  SendOutlined,
  ShareAltOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Dropdown,
  InputNumber,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AuthCodeModal from '../components/AuthCodeModal'
import DelegateModal from '../components/DelegateModal'
import ExportModal from '../components/ExportModal'
import MarkedItemsModal from '../components/MarkedItemsModal'
import QACardUnified from '../components/QACardUnified'
import ShareModal from '../components/ShareModal'
import { datasetsApi, itemsApi, tasksApi } from '../services/api'
import { useSettingsStore } from '../stores/settingsStore'

const { Title, Text } = Typography

const statusColors: Record<string, string> = {
  pending: 'default',
  approved: 'success',
  rejected: 'error',
  modified: 'warning',
}

const statusLabels: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  modified: '已修改',
}

interface ReviewPageProps {
  shareToken?: string
  sharePermission?: string
}

/**
 * 数据集详情页审核组件（重构版）
 * - 使用QACardUnified统一形式
 * - 左右分栏展示编辑
 * - inline diff显示变更
 */
export default function ReviewPageV2({ shareToken, sharePermission }: ReviewPageProps) {
  const { datasetId } = useParams<{ datasetId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dataset, setDataset] = useState<any>(null)
  const [task, setTask] = useState<any>(null)
  const [currentItem, setCurrentItem] = useState<any>(null)
  const [currentIndex, setCurrentIndex] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    modified: 0,
    marked: 0,
  })
  const [jumpToSeq, setJumpToSeq] = useState<number | null>(null)

  // 编辑状态
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<any>(null)

  // 弹窗状态
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [delegateModalOpen, setDelegateModalOpen] = useState(false)
  const [authCodeModalOpen, setAuthCodeModalOpen] = useState(false)
  const [markedItemsModalOpen, setMarkedItemsModalOpen] = useState(false)
  const [markedItemIds, setMarkedItemIds] = useState<number[]>([])
  const [headerExpanded, setHeaderExpanded] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  // 是否可编辑
  const canEdit = !shareToken || sharePermission === 'edit'

  // 获取数据集信息
  useEffect(() => {
    if (datasetId) {
      datasetsApi.get(parseInt(datasetId)).then((res) => setDataset(res.data))
    }
    const taskId = searchParams.get('taskId')
    if (taskId) {
      tasksApi.get(parseInt(taskId)).then((res) => setTask(res.data))
    }
  }, [datasetId, searchParams])

  // 获取语料
  const fetchItem = useCallback(
    async (index: number) => {
      if (!datasetId) return
      setLoading(true)
      try {
        const taskId = searchParams.get('taskId')
        const res = await itemsApi.list(
          parseInt(datasetId),
          index,
          1,
          undefined,
          undefined,
          taskId ? parseInt(taskId) : undefined,
        )
        const {
          items,
          total,
          pending_count,
          approved_count,
          rejected_count,
          modified_count,
          marked_count,
        } = res.data
        setTotalItems(total)
        setStats({
          pending: pending_count || 0,
          approved: approved_count || 0,
          rejected: rejected_count || 0,
          modified: modified_count || 0,
          marked: marked_count || 0,
        })
        if (items.length > 0) {
          // 防御性规范化，移除可能的 BOM 键，确保前端显示正常
          const { normalizeJsonKeys } = await import('../utils/json')
          const normalized = normalizeJsonKeys(items[0])
          console.debug('[ReviewPageV2] fetchItem normalized', normalized)
          ;(window as any).__revdata_debug_logs = (window as any).__revdata_debug_logs || []
          ;(window as any).__revdata_debug_logs.push({
            tag: 'ReviewPageV2',
            t: Date.now(),
            type: 'fetchItem_normalized',
            seq: index,
            normalizedKeys: Object.keys(normalized || {}),
            currentKeys: Object.keys(normalized?.current_content || {}),
          })
          setCurrentItem(normalized)
          setCurrentIndex(index)
          setEditingContent(JSON.parse(JSON.stringify(normalized.current_content)))
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
    if (currentIndex < totalItems && !editingField) {
      fetchItem(currentIndex + 1)
    } else if (currentIndex >= totalItems && !editingField) {
      // 到达最后一条，显示完成提示
      setIsCompleted(true)
    }
  }

  const goToSeq = (seq: number) => {
    if (editingField) return

    // 无论是全局模式还是任务模式，seq 在此处都代表列表中的索引(page)
    // 因为 InputNumber 的 max 限制为 totalItems (当前列表总数)
    if (seq >= 1 && seq <= totalItems) {
      fetchItem(seq)
      setJumpToSeq(null)
    } else {
      message.warning(`索引 ${seq} 超出范围`)
    }
  }

  const goToNextPending = async () => {
    if (!datasetId || editingField) return
    try {
      const taskId = searchParams.get('taskId')
      const res = await itemsApi.list(
        parseInt(datasetId),
        1,
        1,
        'pending',
        undefined,
        taskId ? parseInt(taskId) : undefined,
      )
      if (res.data.items.length > 0) {
        const item = res.data.items[0]
        if (taskId && task) {
          // 任务模式下，需要计算相对索引
          if (task.item_ids) {
            // 离散任务，暂时无法自动跳转到准确位置，除非遍历
            // 简单处理：提示用户
            message.info('离散任务模式下暂不支持自动跳转到下一条待审核')
          } else {
            // 范围任务
            const relativeIndex = item.seq_num - task.item_start + 1
            fetchItem(relativeIndex)
          }
        } else {
          // 全局模式，seq_num 即为索引
          fetchItem(item.seq_num)
        }
      } else {
        message.info('没有待审核的语料了')
      }
    } catch (error) {
      message.error('跳转失败')
    }
  }

  // 跳转到指定状态的第一个语料
  const goToStatus = async (status: string) => {
    if (!datasetId || editingField) return
    try {
      const taskId = searchParams.get('taskId')
      const res = await itemsApi.list(
        parseInt(datasetId),
        1,
        1,
        status,
        undefined,
        taskId ? parseInt(taskId) : undefined,
      )
      if (res.data.items.length > 0) {
        const item = res.data.items[0]
        if (taskId && task) {
          if (task.item_ids) {
            message.info('离散任务模式下暂不支持按状态跳转')
          } else {
            const relativeIndex = item.seq_num - task.item_start + 1
            fetchItem(relativeIndex)
          }
        } else {
          fetchItem(item.seq_num)
        }
      } else {
        const statusLabels: Record<string, string> = {
          pending: '待审核',
          approved: '已通过',
          rejected: '已拒绝',
          modified: '已修改',
        }
        message.info(`没有${statusLabels[status] || status}状态的语料`)
      }
    } catch (error) {
      message.error('跳转失败')
    }
  }

  // 跳转到第一个标记的语料
  const goToMarked = async () => {
    if (!datasetId || editingField) return
    try {
      const taskId = searchParams.get('taskId')
      const res = await itemsApi.list(
        parseInt(datasetId),
        1,
        1,
        undefined,
        true,
        taskId ? parseInt(taskId) : undefined,
      )
      if (res.data.items.length > 0) {
        const item = res.data.items[0]
        if (taskId && task) {
          if (task.item_ids) {
            message.info('离散任务模式下暂不支持按标记跳转')
          } else {
            const relativeIndex = item.seq_num - task.item_start + 1
            fetchItem(relativeIndex)
          }
        } else {
          fetchItem(item.seq_num)
        }
      } else {
        message.info('没有标记的语料')
      }
    } catch (error) {
      message.error('跳转失败')
    }
  }

  // 开始编辑
  const startEdit = (field: string) => {
    if (!canEdit) {
      message.warning('当前模式不可编辑')
      return
    }
    console.debug('[ReviewPageV2] startEdit', field, {
      seq: currentItem?.seq_num,
      id: currentItem?.id,
      keys: Object.keys(currentItem?.current_content || {}),
    })
    // push to global debug logs (temporary)
    ;(window as any).__revdata_debug_logs = (window as any).__revdata_debug_logs || []
    ;(window as any).__revdata_debug_logs.push({
      tag: 'ReviewPageV2',
      t: Date.now(),
      type: 'startEdit',
      field,
      seq: currentItem?.seq_num,
      id: currentItem?.id,
    })

    setEditingField(field)
    try {
      setEditingContent(JSON.parse(JSON.stringify(currentItem.current_content)))
    } catch (e) {
      console.error('[ReviewPageV2] startEdit deep copy failed', e, currentItem)
      ;(window as any).__revdata_debug_logs.push({
        tag: 'ReviewPageV2',
        t: Date.now(),
        type: 'startEdit_error',
        err: String(e),
      })
      setEditingContent(currentItem?.current_content)
    }
  }

  // 保存
  const handleSave = async () => {
    if (!currentItem || !canEdit) return
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
    if (!currentItem || !canEdit || editingField) return
    setSaving(true)
    try {
      await itemsApi.approve(currentItem.id)
      message.success('已通过')
      if (currentIndex >= totalItems) {
        setIsCompleted(true)
      } else {
        goNext()
      }
    } catch (error) {
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  // 拒绝
  const handleReject = async () => {
    if (!currentItem || !canEdit || editingField) return
    setSaving(true)
    try {
      await itemsApi.reject(currentItem.id)
      message.success('已拒绝')
      if (currentIndex >= totalItems) {
        setIsCompleted(true)
      } else {
        goNext()
      }
    } catch (error) {
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  // 标记/取消标记
  const handleMark = async () => {
    if (!currentItem || !canEdit || editingField) return
    setSaving(true)
    try {
      const newMarked = !currentItem.is_marked
      await itemsApi.update(currentItem.id, {
        current_content: currentItem.current_content,
        is_marked: newMarked,
      })
      message.success(newMarked ? '已标记' : '已取消标记')
      fetchItem(currentIndex)
    } catch (error) {
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  // 完成任务
  const handleCompleteTask = async () => {
    const taskId = searchParams.get('taskId')
    if (!taskId) return

    setSaving(true)
    try {
      await tasksApi.complete(parseInt(taskId))
      message.success('任务已完成')
      navigate('/tasks')
    } catch (error) {
      message.error('完成任务失败')
    } finally {
      setSaving(false)
    }
  }

  // 委托标记的语料
  const handleDelegateMarked = async () => {
    if (!datasetId) return
    setLoading(true)
    try {
      // 获取所有标记的语料
      const res = await itemsApi.list(parseInt(datasetId), 1, 1000, undefined, true)
      const items = res.data.items
      if (items.length === 0) {
        message.info('没有标记的语料')
        return
      }
      const ids = items.map((item: any) => item.id)
      setMarkedItemIds(ids)
      setAuthCodeModalOpen(true)
    } catch (error) {
      message.error('获取标记语料失败')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAuthCode = (ids: number[]) => {
    setMarkedItemIds(ids)
    setAuthCodeModalOpen(true)
  }

  const handleDelegateToUser = (ids: number[]) => {
    setMarkedItemIds(ids)
    setDelegateModalOpen(true)
  }

  // 快捷键
  const hotkeys = useSettingsStore((state) => state.hotkeys)
  const theme = useSettingsStore((state) => state.theme)

  useHotkeys(hotkeys.prevItem, goPrev, { enabled: !editingField })
  useHotkeys(hotkeys.nextItem, goNext, { enabled: !editingField })
  useHotkeys(hotkeys.approve, handleApprove, {
    enabled: !editingField && canEdit,
    preventDefault: true,
  })
  useHotkeys(hotkeys.reject, handleReject, {
    enabled: !editingField && canEdit,
    preventDefault: true,
  })
  useHotkeys(hotkeys.focusQ, () => startEdit('q_0'), {
    enabled: !editingField && canEdit,
    preventDefault: true,
  })
  useHotkeys(hotkeys.focusA, () => startEdit('a_0'), {
    enabled: !editingField && canEdit,
    preventDefault: true,
  })
  useHotkeys(hotkeys.save, handleSave, {
    enabled: !!editingField && canEdit,
    preventDefault: true,
    enableOnFormTags: true,
  })
  useHotkeys(hotkeys.cancel, handleCancel, {
    enabled: !!editingField,
    enableOnFormTags: true,
  })
  useHotkeys('ctrl+g', () => document.getElementById('jump-input')?.focus(), {
    preventDefault: true,
  })
  useHotkeys(hotkeys.jumpToNext, goToNextPending, { enabled: !editingField, preventDefault: true })

  const actionMenuItems = [
    {
      key: 'share',
      icon: <ShareAltOutlined />,
      label: '分享',
      onClick: () => setShareModalOpen(true),
      disabled: task?.status === 'completed',
    },
    {
      key: 'export',
      icon: <DownloadOutlined />,
      label: '导出',
      onClick: () => setExportModalOpen(true),
    },
  ]

  // 如果是任务模式，添加完成任务选项
  const taskId = searchParams.get('taskId')
  if (taskId && !shareToken) {
    actionMenuItems.push({
      key: 'complete',
      icon: <CheckCircleOutlined />,
      label: '完成任务',
      onClick: handleCompleteTask,
      disabled: task?.status === 'completed',
    })
  }

  // 完成状态显示
  if (isCompleted) {
    return (
      <div
        style={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Card
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            maxWidth: 500,
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
          </div>
          <Title level={3}>审核任务已完成</Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            感谢您的辛勤工作！您已完成所有分配的语料审核。
          </Text>
          <div style={{ marginTop: 32 }}>
            <Space size="large">
              <Button
                size="large"
                type="primary"
                onClick={async () => {
                  const taskId = searchParams.get('taskId')
                  if (taskId && task) {
                    try {
                      await tasksApi.complete(parseInt(taskId, 10))
                      message.success('任务已完成')
                    } catch (error: any) {
                      message.error(error.response?.data?.detail || '完成任务失败')
                    }
                  }
                  navigate(taskId ? '/tasks' : '/datasets')
                }}
              >
                完成并退出
              </Button>
              <Button
                size="large"
                onClick={() => {
                  setIsCompleted(false)
                  fetchItem(1)
                }}
              >
                重新检查
              </Button>
            </Space>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              const taskId = searchParams.get('taskId')
              navigate(taskId ? '/tasks' : '/datasets')
            }}
          >
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {dataset?.name || '加载中...'}
          </Title>
          {shareToken && (
            <Tag color="blue">
              {sharePermission === 'view' ? '只读' : sharePermission === 'edit' ? '可编辑' : '评论'}
            </Tag>
          )}
        </Space>
        <Space>
          {!shareToken && (
            <Dropdown menu={{ items: actionMenuItems }}>
              <Button>更多操作</Button>
            </Dropdown>
          )}
        </Space>
      </div>

      {/* 统计栏 (Compact & Expandable) */}
      <div
        style={{
          marginBottom: 16,
          position: 'relative',
          zIndex: 100,
          height: 46,
        }}
        onMouseEnter={() => setHeaderExpanded(true)}
        onMouseLeave={() => setHeaderExpanded(false)}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            padding: headerExpanded ? '12px 24px' : '8px 24px',
            transition: 'all 0.3s ease',
            overflow: 'hidden',
            height: headerExpanded ? 100 : 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left: Summary */}
          <Space size="large" style={{ minWidth: 200 }}>
            <Text strong style={{ fontSize: 16 }}>
              进度: {currentIndex} / {totalItems}
            </Text>
            {!headerExpanded && (
              <Space>
                <Tag color="default">待审 {stats.pending}</Tag>
                <Tag color="purple">待定 {stats.marked}</Tag>
              </Space>
            )}
          </Space>

          {/* Middle: Expanded Stats */}
          <div
            style={{
              opacity: headerExpanded ? 1 : 0,
              transition: 'opacity 0.2s',
              display: 'flex',
              gap: 32,
              visibility: headerExpanded ? 'visible' : 'hidden',
            }}
          >
            <div style={{ cursor: 'pointer' }} onClick={() => goToStatus('pending')}>
              <Statistic
                title="待审核"
                value={stats.pending}
                valueStyle={{ fontSize: 20, color: '#999' }}
              />
            </div>
            <div style={{ cursor: 'pointer' }} onClick={() => goToStatus('approved')}>
              <Statistic
                title="已通过"
                value={stats.approved}
                valueStyle={{ fontSize: 20, color: '#52c41a' }}
              />
            </div>
            <div style={{ cursor: 'pointer' }} onClick={() => goToStatus('rejected')}>
              <Statistic
                title="已拒绝"
                value={stats.rejected}
                valueStyle={{ fontSize: 20, color: '#ff4d4f' }}
              />
            </div>
            <div style={{ cursor: 'pointer' }} onClick={() => goToStatus('modified')}>
              <Statistic
                title="已修改"
                value={stats.modified}
                valueStyle={{ fontSize: 20, color: '#faad14' }}
              />
            </div>
            <div style={{ cursor: 'pointer' }} onClick={() => goToMarked()}>
              <Statistic
                title="待定(Marked)"
                value={stats.marked}
                valueStyle={{ fontSize: 20, color: '#722ed1' }}
              />
            </div>
          </div>

          {/* Right: Jump Controls */}
          <Space>
            <Text>跳转:</Text>
            <InputNumber
              size="small"
              min={1}
              max={totalItems}
              value={jumpToSeq}
              onChange={(v) => setJumpToSeq(v)}
              onPressEnter={() => jumpToSeq && goToSeq(jumpToSeq)}
              style={{ width: 80 }}
              disabled={!!editingField}
            />
            <Button
              size="small"
              icon={<FastForwardOutlined />}
              onClick={goToNextPending}
              disabled={!!editingField}
            >
              下一待审
            </Button>
          </Space>
        </div>
      </div>

      {/* 快捷键提示 */}
      <div
        style={{
          marginBottom: 8,
          padding: '8px 12px',
          background: '#f5f5f5',
          borderRadius: 4,
          fontSize: 12,
          color: '#666',
        }}
      >
        <Space split="|" wrap>
          <span>
            {hotkeys.prevItem}/{hotkeys.nextItem} 翻页
          </span>
          <span>{hotkeys.approve} 通过</span>
          <span>{hotkeys.reject} 拒绝</span>
          <span>{hotkeys.focusQ} 编辑问题</span>
          <span>{hotkeys.focusA} 编辑回答</span>
          <span>tab 下一个栏目</span>
          <span>{hotkeys.save} 保存</span>
          <span>{hotkeys.cancel} 取消</span>
          <span>{hotkeys.jumpToNext} 下一待审</span>
        </Space>
      </div>

      {/* 审核卡片 */}
      <Spin spinning={loading}>
        <Card
          className="review-card active"
          title={
            <Space>
              <span style={{ fontSize: 18, fontWeight: 600 }}>#{currentItem?.seq_num || '-'}</span>
              <Tag>{currentItem?.item_type === 'qa' ? 'QA对话' : '纯文本'}</Tag>
              <Tag color={statusColors[currentItem?.status || 'pending']}>
                {statusLabels[currentItem?.status || 'pending']}
              </Tag>
              {currentItem?.has_changes && <Tag color="blue">有修改</Tag>}
              {currentItem?.is_marked && (
                <Tag color="purple" icon={<FlagOutlined />}>
                  待定
                </Tag>
              )}
            </Space>
          }
          extra={
            <Space>
              <Text style={{ fontSize: 16 }}>
                <strong>{currentIndex}</strong> / {totalItems}
              </Text>
            </Space>
          }
          styles={{ body: { padding: 24, minHeight: 300 } }}
        >
          {currentItem && (
            <QACardUnified
              originalContent={currentItem.original_content}
              currentContent={editingContent || currentItem.current_content}
              seqNum={currentItem.seq_num}
              theme={theme}
              fieldMapping={dataset?.field_mapping}
              datasetSourceFile={dataset?.source_file}
              editingField={editingField}
              onStartEdit={startEdit}
              onContentChange={setEditingContent}
              onSave={handleSave}
              onCancel={handleCancel}
              readOnly={!canEdit}
            />
          )}
        </Card>
      </Spin>

      {/* 临时调试面板（编辑时显示） */}
      {editingField && (
        <div
          style={{
            position: 'fixed',
            right: 12,
            bottom: 12,
            width: 360,
            maxHeight: 220,
            overflow: 'auto',
            background: '#fff',
            border: '1px solid #e8e8e8',
            padding: 10,
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            zIndex: 9999,
          }}
        >
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            <strong>调试日志 (最近)</strong>
          </div>
          <div style={{ fontSize: 12, color: '#444' }}>
            {((window as any).__revdata_debug_logs || [])
              .slice(-30)
              .reverse()
              .map((l: any, i: number) => (
                <div
                  key={i}
                  style={{ marginBottom: 6, borderBottom: '1px dashed #f0f0f0', paddingBottom: 4 }}
                >
                  <div style={{ color: '#999', fontSize: 11 }}>
                    {new Date(l.t).toLocaleTimeString()}
                  </div>
                  <div>
                    <strong>{l.tag}</strong> · {l.type} {l.field ? <span>· {l.field}</span> : null}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#222' }}>
                    {' '}
                    {JSON.stringify(l, null, 2)}{' '}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 16,
          padding: 16,
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <Space size="large">
          <Button
            size="large"
            icon={<LeftOutlined />}
            onClick={goPrev}
            disabled={currentIndex <= 1 || !!editingField}
          >
            上一条
          </Button>

          {editingField ? (
            <>
              <Button size="large" onClick={handleCancel}>
                取消 ({hotkeys.cancel})
              </Button>
              <Button size="large" type="primary" onClick={handleSave} loading={saving}>
                保存 ({hotkeys.save.toUpperCase()})
              </Button>
            </>
          ) : (
            canEdit && (
              <>
                <Button
                  size="large"
                  icon={<FlagOutlined />}
                  onClick={handleMark}
                  loading={saving}
                  disabled={task?.status === 'completed'}
                >
                  {currentItem?.is_marked ? '取消标记' : '标记'}
                </Button>
                {stats.marked > 0 && (
                  <Button
                    size="large"
                    icon={<SendOutlined />}
                    onClick={handleDelegateMarked}
                    loading={loading}
                    disabled={task?.status === 'completed'}
                  >
                    生成委派 ({stats.marked})
                  </Button>
                )}
                <Button
                  size="large"
                  type="primary"
                  danger
                  onClick={handleReject}
                  loading={saving}
                  disabled={task?.status === 'completed'}
                >
                  拒绝 ({hotkeys.reject.toUpperCase()})
                </Button>
                <Button
                  size="large"
                  type="primary"
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  onClick={handleApprove}
                  loading={saving}
                  disabled={task?.status === 'completed'}
                >
                  通过 ({hotkeys.approve.toUpperCase()})
                </Button>
              </>
            )
          )}

          <Button
            size="large"
            icon={<RightOutlined />}
            onClick={goNext}
            disabled={currentIndex >= totalItems || !!editingField}
          >
            下一条
          </Button>
        </Space>
      </div>

      {/* 弹窗 */}
      <AuthCodeModal
        open={authCodeModalOpen}
        onClose={() => setAuthCodeModalOpen(false)}
        datasetId={parseInt(datasetId || '0')}
        itemIds={markedItemIds}
      />
      <MarkedItemsModal
        open={markedItemsModalOpen}
        onClose={() => setMarkedItemsModalOpen(false)}
        datasetId={parseInt(datasetId || '0')}
        onGenerateAuthCode={handleGenerateAuthCode}
        onDelegate={handleDelegateToUser}
      />
      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        datasetId={parseInt(datasetId || '0')}
      />
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        datasetId={parseInt(datasetId || '0')}
        datasetName={dataset?.name || 'dataset'}
      />
      <DelegateModal
        open={delegateModalOpen}
        onClose={() => setDelegateModalOpen(false)}
        datasetId={parseInt(datasetId || '0')}
        currentItemSeq={currentItem?.seq_num || 1}
        totalItems={totalItems}
        itemIds={markedItemIds}
      />
    </div>
  )
}
