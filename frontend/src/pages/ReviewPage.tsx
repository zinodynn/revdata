import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  LeftOutlined,
  RightOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, Input, Row, Space, Spin, Statistic, Tag, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate, useParams } from 'react-router-dom'
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

export default function ReviewPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dataset, setDataset] = useState<any>(null)
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, modified: 0 })

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
      const { items, total, pending_count, approved_count, rejected_count, modified_count } = res.data
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
    fetchItems(1)
  }, [datasetId])

  // 上一条
  const goPrev = () => {
    if (currentIndex > 1) {
      fetchItems(currentIndex - 1)
    }
  }

  // 下一条
  const goNext = () => {
    if (currentIndex < totalItems) {
      fetchItems(currentIndex + 1)
    }
  }

  // 通过
  const handleApprove = async () => {
    if (!currentItem) return
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
    if (!currentItem) return
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

  // 保存修改
  const handleSave = async () => {
    if (!currentItem || !editingContent) return
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
  useHotkeys('ctrl+enter', handleApprove, { enabled: !isEditing, preventDefault: true })
  useHotkeys('ctrl+shift+enter', handleReject, { enabled: !isEditing, preventDefault: true })
  useHotkeys('ctrl+e', () => setEditing(true), { enabled: !isEditing, preventDefault: true })
  useHotkeys('alt+s', handleSave, { enabled: isEditing, preventDefault: true })
  useHotkeys('escape', () => setEditing(false), { enabled: isEditing })

  // 获取内容文本
  const getContentText = (content: any): string => {
    if (!content) return ''
    if (content.text) return content.text
    if (content.messages) {
      return content.messages.map((m: any) => `[${m.role}]: ${m.content}`).join('\n\n')
    }
    return JSON.stringify(content, null, 2)
  }

  // 渲染内容
  const renderContent = () => {
    if (!currentItem) return null

    const originalText = getContentText(currentItem.original_content)
    const currentText = getContentText(currentItem.current_content)

    if (isEditing) {
      // 编辑模式
      if (currentItem.item_type === 'qa' && currentItem.current_content.messages) {
        return (
          <div className="qa-container">
            <div className="qa-column qa-question">
              <Text strong>问题 (Q)</Text>
              <TextArea
                value={editingContent?.messages?.[0]?.content || ''}
                onChange={(e) => {
                  const newContent = { ...editingContent }
                  if (newContent.messages && newContent.messages[0]) {
                    newContent.messages[0].content = e.target.value
                    setEditingContent(newContent)
                  }
                }}
                rows={6}
                style={{ marginTop: 8 }}
              />
            </div>
            <div className="qa-column qa-answer">
              <Text strong>回答 (A)</Text>
              <TextArea
                value={editingContent?.messages?.[1]?.content || ''}
                onChange={(e) => {
                  const newContent = { ...editingContent }
                  if (newContent.messages && newContent.messages[1]) {
                    newContent.messages[1].content = e.target.value
                    setEditingContent(newContent)
                  }
                }}
                rows={6}
                style={{ marginTop: 8 }}
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
                // 保持原样
              }
            }
          }}
          rows={12}
        />
      )
    }

    // 查看模式 - 显示差异
    if (currentItem.has_changes) {
      return (
        <ReactDiffViewer
          oldValue={originalText}
          newValue={currentText}
          splitView={true}
          compareMethod={DiffMethod.WORDS}
          leftTitle="原始内容"
          rightTitle="当前内容"
          styles={{
            variables: {
              light: {
                diffViewerBackground: '#fff',
                addedBackground: '#e6ffed',
                removedBackground: '#ffeef0',
              },
            },
          }}
        />
      )
    }

    // QA类型展示
    if (currentItem.item_type === 'qa' && currentItem.current_content.messages) {
      const messages = currentItem.current_content.messages
      return (
        <div className="qa-container">
          <div className="qa-column qa-question">
            <Text strong>问题 (Q)</Text>
            <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
              {messages[0]?.content}
            </div>
          </div>
          <div className="qa-column qa-answer">
            <Text strong>回答 (A)</Text>
            <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
              {messages[1]?.content}
            </div>
          </div>
        </div>
      )
    }

    // 纯文本展示
    return (
      <div style={{ whiteSpace: 'pre-wrap', padding: 16, background: '#fafafa', borderRadius: 8 }}>
        {currentText}
      </div>
    )
  }

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
        </Space>
        <Space>
          <Text type="secondary">
            快捷键: PgUp/PgDn 翻页 | Ctrl+Enter 通过 | Ctrl+Shift+Enter 拒绝 | Ctrl+E 编辑 | Alt+S 保存
          </Text>
        </Space>
      </div>

      {/* 统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="待审核" value={stats.pending} valueStyle={{ color: '#999' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已通过" value={stats.approved} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已拒绝" value={stats.rejected} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已修改" value={stats.modified} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      {/* 审核卡片 */}
      <Spin spinning={loading}>
        <Card
          className="review-card active"
          title={
            <Space>
              <span>#{currentItem?.seq_num || '-'}</span>
              <Tag>{currentItem?.item_type === 'qa' ? 'QA对话' : '纯文本'}</Tag>
              <Tag color={statusColors[currentItem?.status || 'pending']}>
                {statusLabels[currentItem?.status || 'pending']}
              </Tag>
              {currentItem?.has_changes && <Tag color="blue">有修改</Tag>}
            </Space>
          }
          extra={
            <Space>
              <Text type="secondary">
                {currentIndex} / {totalItems}
              </Text>
            </Space>
          }
        >
          {renderContent()}
        </Card>
      </Spin>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <Space size="large">
          <Button icon={<LeftOutlined />} onClick={goPrev} disabled={currentIndex <= 1}>
            上一条
          </Button>
          {isEditing ? (
            <>
              <Button icon={<SaveOutlined />} type="primary" onClick={handleSave} loading={saving}>
                保存 (Ctrl+S)
              </Button>
              <Button onClick={() => setEditing(false)}>取消 (Esc)</Button>
            </>
          ) : (
            <>
              <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
                编辑 (Ctrl+E)
              </Button>
              <Button
                icon={<CheckOutlined />}
                type="primary"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={handleApprove}
                loading={saving}
              >
                通过 (Ctrl+Enter)
              </Button>
              <Button icon={<CloseOutlined />} danger onClick={handleReject} loading={saving}>
                拒绝 (Ctrl+Shift+Enter)
              </Button>
            </>
          )}
          <Button icon={<RightOutlined />} onClick={goNext} disabled={currentIndex >= totalItems}>
            下一条
          </Button>
        </Space>
      </div>
    </div>
  )
}
