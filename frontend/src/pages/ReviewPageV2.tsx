import {
  ArrowLeftOutlined,
  DownloadOutlined,
  FastForwardOutlined,
  LeftOutlined,
  RightOutlined,
  SendOutlined,
  ShareAltOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Dropdown,
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
import { useCallback, useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import DelegateModal from '../components/DelegateModal'
import ExportModal from '../components/ExportModal'
import QACardUnified from '../components/QACardUnified'
import ShareModal from '../components/ShareModal'
import { datasetsApi, itemsApi } from '../services/api'

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
  const [currentItem, setCurrentItem] = useState<any>(null)
  const [currentIndex, setCurrentIndex] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, modified: 0 })
  const [jumpToSeq, setJumpToSeq] = useState<number | null>(null)
  
  // 编辑状态
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<any>(null)
  
  // 弹窗状态
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [delegateModalOpen, setDelegateModalOpen] = useState(false)

  // 是否可编辑
  const canEdit = !shareToken || sharePermission === 'edit'

  // 获取数据集信息
  useEffect(() => {
    if (datasetId) {
      datasetsApi.get(parseInt(datasetId)).then((res) => setDataset(res.data))
    }
  }, [datasetId])

  // 获取语料
  const fetchItem = useCallback(async (index: number) => {
    if (!datasetId) return
    setLoading(true)
    try {
      const res = await itemsApi.list(parseInt(datasetId), index, 1)
      const { items, total, pending_count, approved_count, rejected_count, modified_count } = res.data
      setTotalItems(total)
      setStats({
        pending: pending_count || 0,
        approved: approved_count || 0,
        rejected: rejected_count || 0,
        modified: modified_count || 0,
      })
      if (items.length > 0) {
        // 防御性规范化，移除可能的 BOM 键，确保前端显示正常
        const { normalizeJsonKeys } = await import('../utils/json')
        const normalized = normalizeJsonKeys(items[0])
        console.debug('[ReviewPageV2] fetchItem normalized', normalized)
        ;(window as any).__revdata_debug_logs = (window as any).__revdata_debug_logs || []
        ;(window as any).__revdata_debug_logs.push({ tag: 'ReviewPageV2', t: Date.now(), type: 'fetchItem_normalized', seq: index, normalizedKeys: Object.keys(normalized || {}), currentKeys: Object.keys(normalized?.current_content || {}) })
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
  }, [datasetId])

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

  const goToSeq = (seq: number) => {
    if (seq >= 1 && seq <= totalItems && !editingField) {
      fetchItem(seq)
      setJumpToSeq(null)
    }
  }

  const goToNextPending = async () => {
    if (!datasetId || editingField) return
    try {
      const res = await itemsApi.list(parseInt(datasetId), 1, 1, 'pending')
      if (res.data.items.length > 0) {
        fetchItem(res.data.items[0].seq_num)
      } else {
        message.info('没有待审核的语料了')
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
    console.debug('[ReviewPageV2] startEdit', field, { seq: currentItem?.seq_num, id: currentItem?.id, keys: Object.keys(currentItem?.current_content || {}) })
    // push to global debug logs (temporary)
    ;(window as any).__revdata_debug_logs = (window as any).__revdata_debug_logs || []
    ;(window as any).__revdata_debug_logs.push({ tag: 'ReviewPageV2', t: Date.now(), type: 'startEdit', field, seq: currentItem?.seq_num, id: currentItem?.id })

    setEditingField(field)
    try {
      setEditingContent(JSON.parse(JSON.stringify(currentItem.current_content)))
    } catch (e) {
      console.error('[ReviewPageV2] startEdit deep copy failed', e, currentItem)
      ;(window as any).__revdata_debug_logs.push({ tag: 'ReviewPageV2', t: Date.now(), type: 'startEdit_error', err: String(e) })
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
      goNext()
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
      goNext()
    } catch (error) {
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  // 快捷键
  useHotkeys('pageup', goPrev, { enabled: !editingField })
  useHotkeys('pagedown', goNext, { enabled: !editingField })
  useHotkeys('ctrl+enter', handleApprove, { enabled: !editingField && canEdit, preventDefault: true })
  useHotkeys('ctrl+shift+enter', handleReject, { enabled: !editingField && canEdit, preventDefault: true })
  useHotkeys('q', () => startEdit('q_0'), { enabled: !editingField && canEdit, preventDefault: true })
  useHotkeys('a', () => startEdit('a_0'), { enabled: !editingField && canEdit, preventDefault: true })
  useHotkeys('ctrl+s', handleSave, { enabled: !!editingField && canEdit, preventDefault: true })
  useHotkeys('escape', handleCancel, { enabled: !!editingField })
  useHotkeys('ctrl+g', () => document.getElementById('jump-input')?.focus(), { preventDefault: true })
  useHotkeys('ctrl+shift+n', goToNextPending, { enabled: !editingField, preventDefault: true })

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
                disabled={!!editingField}
              />
              <Button onClick={() => jumpToSeq && goToSeq(jumpToSeq)} disabled={!!editingField}>
                跳转
              </Button>
              <Tooltip title="跳转到下一个待审核 (Ctrl+Shift+N)">
                <Button icon={<FastForwardOutlined />} onClick={goToNextPending} disabled={!!editingField}>
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
          <span>q 编辑问题</span>
          <span>a 编辑回答</span>
          <span>Ctrl+S 保存</span>
          <span>Esc 取消</span>
          <span>Ctrl+G 跳转</span>
          <span>Ctrl+Shift+N 下一待审</span>
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
          {currentItem && (
            <QACardUnified
              originalContent={currentItem.original_content}
              currentContent={editingField ? editingContent : currentItem.current_content}
              seqNum={currentItem.seq_num}
              fieldMapping={dataset?.field_mapping}
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
        <div style={{ position: 'fixed', right: 12, bottom: 12, width: 360, maxHeight: 220, overflow: 'auto', background: '#fff', border: '1px solid #e8e8e8', padding: 10, borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', zIndex: 9999 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}><strong>调试日志 (最近)</strong></div>
          <div style={{ fontSize: 12, color: '#444' }}>
            {((window as any).__revdata_debug_logs || []).slice(-30).reverse().map((l: any, i: number) => (
              <div key={i} style={{ marginBottom: 6, borderBottom: '1px dashed #f0f0f0', paddingBottom: 4 }}>
                <div style={{ color: '#999', fontSize: 11 }}>{new Date(l.t).toLocaleTimeString()}</div>
                <div><strong>{l.tag}</strong> · {l.type} {l.field ? <span>· {l.field}</span> : null}</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#222' }}> {JSON.stringify(l, null, 2)} </div>
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
          <Button size="large" icon={<LeftOutlined />} onClick={goPrev} disabled={currentIndex <= 1 || !!editingField}>
            上一条
          </Button>
          
          {editingField ? (
            <>
              <Button size="large" onClick={handleCancel}>
                取消 (Esc)
              </Button>
              <Button size="large" type="primary" onClick={handleSave} loading={saving}>
                保存 (Ctrl+S)
              </Button>
            </>
          ) : (
            canEdit && (
              <>
                <Button
                  size="large"
                  type="primary"
                  danger
                  onClick={handleReject}
                  loading={saving}
                >
                  拒绝 (Ctrl+Shift+Enter)
                </Button>
                <Button
                  size="large"
                  type="primary"
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  onClick={handleApprove}
                  loading={saving}
                >
                  通过 (Ctrl+Enter)
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
