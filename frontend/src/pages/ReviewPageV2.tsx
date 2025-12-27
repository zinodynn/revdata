import {
    ArrowLeftOutlined,
    CheckOutlined,
    CloseOutlined,
    DownloadOutlined,
    EditOutlined,
    FastForwardOutlined,
    LeftOutlined,
    RightOutlined,
    SaveOutlined,
    SendOutlined,
    ShareAltOutlined,
} from '@ant-design/icons'
import {
    Button,
    Card,
    Col,
    Dropdown,
    Input,
    InputNumber,
    Row,
    Space,
    Spin,
    Statistic,
    Tag,
    Tooltip,
    Typography,
    message,
} from 'antd'
import { useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import DelegateModal from '../components/DelegateModal'
import DiffCard from '../components/DiffCard'
import ExportModal from '../components/ExportModal'
import ShareModal from '../components/ShareModal'
import { datasetsApi, itemsApi } from '../services/api'
import { useReviewStore } from '../stores/reviewStore'

const { Title, Text } = Typography
const { TextArea } = Input

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

export default function ReviewPageV2({ shareToken, sharePermission }: ReviewPageProps) {
  const { datasetId } = useParams<{ datasetId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dataset, setDataset] = useState<any>(null)
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, modified: 0 })
  const [jumpToSeq, setJumpToSeq] = useState<number | null>(null)
  
  // 弹窗状态
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [delegateModalOpen, setDelegateModalOpen] = useState(false)

  const {
    currentItem,
    currentIndex,
    totalItems,
    isEditing,
    editingContent,
    setCurrentItem,
    setItems,
    setCurrentIndex,
    setEditing,
    setEditingContent,
  } = useReviewStore()

  // 是否可编辑模式
  const canEdit = !shareToken || sharePermission === 'edit'

  // 获取数据集信息
  useEffect(() => {
    if (datasetId) {
      datasetsApi.get(parseInt(datasetId)).then((res) => setDataset(res.data))
    }
  }, [datasetId])

  // 获取语料列表
  const fetchItems = async (page = 1) => {
    if (!datasetId) return
    setLoading(true)
    try {
      const res = await itemsApi.list(parseInt(datasetId), page, 1)
      const { items, total, pending_count, approved_count, rejected_count, modified_count } =
        res.data
      setItems(items, total)
      setStats({
        pending: pending_count,
        approved: approved_count,
        rejected: rejected_count,
        modified: modified_count,
      })
      if (items.length > 0) {
        setCurrentItem(items[0])
        setCurrentIndex(page)
      }
    } catch (error) {
      message.error('获取语料失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const seq = searchParams.get('seq')
    if (seq) {
      fetchItems(parseInt(seq))
    } else {
      fetchItems(1)
    }
  }, [datasetId])

  // 导航函数
  const goPrev = () => {
    if (currentIndex > 1) fetchItems(currentIndex - 1)
  }

  const goNext = () => {
    if (currentIndex < totalItems) fetchItems(currentIndex + 1)
  }

  const goToSeq = (seq: number) => {
    if (seq >= 1 && seq <= totalItems) {
      fetchItems(seq)
      setJumpToSeq(null)
    }
  }

  const goToNextPending = async () => {
    if (!datasetId) return
    try {
      const res = await itemsApi.list(parseInt(datasetId), 1, 1, 'pending')
      if (res.data.items.length > 0) {
        const item = res.data.items[0]
        fetchItems(item.seq_num)
      } else {
        message.info('没有待审核的语料了')
      }
    } catch (error) {
      message.error('跳转失败')
    }
  }

  // 操作函数
  const handleApprove = async () => {
    if (!currentItem || !canEdit) return
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

  const handleReject = async () => {
    if (!currentItem || !canEdit) return
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

  const handleSave = async () => {
    if (!currentItem || !editingContent || !canEdit) return
    setSaving(true)
    try {
      await itemsApi.update(currentItem.id, { current_content: editingContent })
      message.success('保存成功')
      setEditing(false)
      fetchItems(currentIndex)
    } catch (error) {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 快捷键
  useHotkeys('pageup', goPrev, { enabled: !isEditing })
  useHotkeys('pagedown', goNext, { enabled: !isEditing })
  useHotkeys('ctrl+enter', handleApprove, { enabled: !isEditing && canEdit, preventDefault: true })
  useHotkeys('ctrl+shift+enter', handleReject, {
    enabled: !isEditing && canEdit,
    preventDefault: true,
  })
  useHotkeys('ctrl+e', () => canEdit && setEditing(true), {
    enabled: !isEditing && canEdit,
    preventDefault: true,
  })
  useHotkeys('ctrl+s', handleSave, { enabled: isEditing && canEdit, preventDefault: true })
  useHotkeys('escape', () => setEditing(false), { enabled: isEditing })
  useHotkeys('ctrl+g', () => document.getElementById('jump-input')?.focus(), {
    preventDefault: true,
  })
  useHotkeys('ctrl+shift+n', goToNextPending, { enabled: !isEditing, preventDefault: true })

  // 渲染编辑器
  const renderEditor = () => {
    if (!currentItem) return null

    if (currentItem.item_type === 'qa' && currentItem.current_content.messages) {
      return (
        <div className="qa-container">
          <div className="qa-column qa-question">
            <Text strong>问题 (Q) <span className="shortcut-hint">Ctrl+Q 聚焦</span></Text>
            <TextArea
              id="editor-q"
              value={editingContent?.messages?.[0]?.content || ''}
              onChange={(e) => {
                const newContent = JSON.parse(JSON.stringify(editingContent))
                if (newContent.messages && newContent.messages[0]) {
                  newContent.messages[0].content = e.target.value
                  setEditingContent(newContent)
                }
              }}
              rows={10}
              style={{ marginTop: 8 }}
              autoSize={{ minRows: 6, maxRows: 20 }}
            />
          </div>
          <div className="qa-column qa-answer">
            <Text strong>回答 (A) <span className="shortcut-hint">Ctrl+A 聚焦</span></Text>
            <TextArea
              id="editor-a"
              value={editingContent?.messages?.[1]?.content || ''}
              onChange={(e) => {
                const newContent = JSON.parse(JSON.stringify(editingContent))
                if (newContent.messages && newContent.messages[1]) {
                  newContent.messages[1].content = e.target.value
                  setEditingContent(newContent)
                }
              }}
              rows={10}
              style={{ marginTop: 8 }}
              autoSize={{ minRows: 6, maxRows: 20 }}
            />
          </div>
        </div>
      )
    }

    return (
      <TextArea
        value={editingContent?.text || JSON.stringify(editingContent, null, 2)}
        onChange={(e) => {
          if (currentItem.current_content.text !== undefined) {
            setEditingContent({ text: e.target.value })
          } else {
            try {
              setEditingContent(JSON.parse(e.target.value))
            } catch {
              // keep as is
            }
          }
        }}
        rows={15}
        autoSize={{ minRows: 10, maxRows: 30 }}
      />
    )
  }

  // 快捷键聚焦编辑器
  useHotkeys(
    'ctrl+q',
    () => {
      if (isEditing) document.getElementById('editor-q')?.focus()
    },
    { enabled: isEditing, preventDefault: true }
  )
  useHotkeys(
    'ctrl+a',
    () => {
      if (isEditing) document.getElementById('editor-a')?.focus()
    },
    { enabled: isEditing, preventDefault: true }
  )

  // 渲染内容
  const renderContent = () => {
    if (!currentItem) return null

    if (isEditing) {
      return renderEditor()
    }

    // 使用差异卡片组件
    return (
      <DiffCard
        itemType={currentItem.item_type}
        originalContent={currentItem.original_content}
        currentContent={currentItem.current_content}
        hasChanges={currentItem.has_changes}
      />
    )
  }

  const actionMenuItems = [
    {
      key: 'share',
      icon: <ShareAltOutlined />,
      label: '分享',
      onClick: () => setShareModalOpen(true),
    },
    {
      key: 'export',
      icon: <DownloadOutlined />,
      label: '导出',
      onClick: () => setExportModalOpen(true),
    },
    {
      key: 'delegate',
      icon: <SendOutlined />,
      label: '委派',
      onClick: () => setDelegateModalOpen(true),
    },
  ]

  return (
    <div>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/datasets')}>
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

      {/* 统计 + 快捷跳转 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="待审核" value={stats.pending} valueStyle={{ color: '#999' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="已通过" value={stats.approved} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="已拒绝" value={stats.rejected} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="已修改" value={stats.modified} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Space>
              <Text>跳转到:</Text>
              <InputNumber
                id="jump-input"
                min={1}
                max={totalItems}
                value={jumpToSeq}
                onChange={(v) => setJumpToSeq(v)}
                onPressEnter={() => jumpToSeq && goToSeq(jumpToSeq)}
                placeholder={`1-${totalItems}`}
                style={{ width: 100 }}
              />
              <Button onClick={() => jumpToSeq && goToSeq(jumpToSeq)}>跳转</Button>
              <Tooltip title="跳转到下一个待审核 (Ctrl+Shift+N)">
                <Button icon={<FastForwardOutlined />} onClick={goToNextPending}>
                  下一待审
                </Button>
              </Tooltip>
            </Space>
          </Card>
        </Col>
      </Row>

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
          <span>PgUp/PgDn 翻页</span>
          <span>Ctrl+Enter 通过</span>
          <span>Ctrl+Shift+Enter 拒绝</span>
          <span>Ctrl+E 编辑</span>
          <span>Ctrl+S 保存</span>
          <span>Ctrl+G 跳转</span>
          <span>Ctrl+Shift+N 下一待审</span>
          {isEditing && <span>Ctrl+Q/A 切换编辑区</span>}
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
          {renderContent()}
        </Card>
      </Spin>

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
          <Button size="large" icon={<LeftOutlined />} onClick={goPrev} disabled={currentIndex <= 1}>
            上一条
          </Button>
          {isEditing ? (
            <>
              <Button
                size="large"
                icon={<SaveOutlined />}
                type="primary"
                onClick={handleSave}
                loading={saving}
              >
                保存 (Ctrl+S)
              </Button>
              <Button size="large" onClick={() => setEditing(false)}>
                取消 (Esc)
              </Button>
            </>
          ) : (
            <>
              {canEdit && (
                <>
                  <Button size="large" icon={<EditOutlined />} onClick={() => setEditing(true)}>
                    编辑
                  </Button>
                  <Button
                    size="large"
                    icon={<CheckOutlined />}
                    type="primary"
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    onClick={handleApprove}
                    loading={saving}
                  >
                    通过
                  </Button>
                  <Button
                    size="large"
                    icon={<CloseOutlined />}
                    danger
                    onClick={handleReject}
                    loading={saving}
                  >
                    拒绝
                  </Button>
                </>
              )}
            </>
          )}
          <Button
            size="large"
            icon={<RightOutlined />}
            onClick={goNext}
            disabled={currentIndex >= totalItems}
          >
            下一条
          </Button>
        </Space>
      </div>

      {/* 弹窗 */}
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
      />
    </div>
  )
}
