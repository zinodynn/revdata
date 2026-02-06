import { BookOutlined, CloseOutlined } from '@ant-design/icons'
import { Button, Select, Space, Tooltip, Typography } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { referenceDocsApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'

const { Text } = Typography

interface ReferenceDoc {
  id: number
  dataset_id: number
  name: string
  file_path: string
  file_type: string
  file_size: number
  created_at: string
}

interface DocumentViewerProps {
  datasetId: number
  theme?: 'light' | 'dark'
}

/**
 * 审核页面右侧文档查看面板
 * - 独立状态管理，不随语料切换刷新
 * - 支持拖拽调整宽度
 * - 使用 iframe 渲染 PDF
 */
function DocumentViewerInner({ datasetId, theme = 'light' }: DocumentViewerProps) {
  const isDark = theme === 'dark'
  const [expanded, setExpanded] = useState(false)
  const [docs, setDocs] = useState<ReferenceDoc[]>([])
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null)
  const [panelWidth, setPanelWidth] = useState(480)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // 获取文档列表
  useEffect(() => {
    if (!datasetId) return
    const fetchDocs = async () => {
      try {
        const res = await referenceDocsApi.list(datasetId)
        const items = res.data.items || []
        setDocs(items)
        // 如果之前没有选中任何文档且有文档，自动选中第一个
        if (items.length > 0 && !selectedDocId) {
          setSelectedDocId(items[0].id)
        }
      } catch {
        // 静默失败，不影响审核
      }
    }
    fetchDocs()
  }, [datasetId])

  // 拖拽调整宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = panelWidth
    e.preventDefault()
  }, [panelWidth])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const diff = startX.current - e.clientX
      const newWidth = Math.max(300, Math.min(900, startWidth.current + diff))
      setPanelWidth(newWidth)
    }
    const handleMouseUp = () => {
      isDragging.current = false
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // 构建文档查看 URL
  const getDocViewUrl = (docId: number) => {
    const token = useAuthStore.getState().token
    const baseUrl = referenceDocsApi.getViewUrl(docId)
    return `${baseUrl}?token=${token || ''}`
  }

  const selectedDoc = docs.find((d) => d.id === selectedDocId)

  if (docs.length === 0 && !expanded) {
    return null // 没有文档时不显示按钮
  }

  // 收起状态: 仅显示按钮
  if (!expanded) {
    return (
      <Tooltip title="查看参考文档" placement="left">
        <Button
          type="primary"
          icon={<BookOutlined />}
          onClick={() => setExpanded(true)}
          style={{
            position: 'fixed',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000,
            height: 48,
            width: 48,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        />
      </Tooltip>
    )
  }

  // 展开状态
  return (
    <div
      style={{
        width: panelWidth,
        height: '100vh',
        position: 'fixed',
        right: 0,
        top: 0,
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        background: isDark ? '#1f1f1f' : '#fff',
        borderLeft: isDark ? '1px solid #434343' : '1px solid #d9d9d9',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
      }}
    >
      {/* 拖拽手柄 */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          left: -4,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'col-resize',
          zIndex: 1001,
        }}
      />

      {/* 头部 */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: isDark ? '1px solid #434343' : '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Space>
          <BookOutlined />
          <Text strong>参考文档</Text>
        </Space>
        <Button
          type="text"
          icon={<CloseOutlined />}
          size="small"
          onClick={() => setExpanded(false)}
        />
      </div>

      {/* 文档选择器 */}
      <div style={{ padding: '8px 16px', flexShrink: 0 }}>
        <Select
          style={{ width: '100%' }}
          placeholder="选择文档"
          value={selectedDocId}
          onChange={(val) => setSelectedDocId(val)}
          options={docs.map((doc) => ({
            label: `${doc.name} (${doc.file_type.toUpperCase()})`,
            value: doc.id,
          }))}
        />
      </div>

      {/* 文档查看区域 */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {selectedDocId && selectedDoc ? (
          selectedDoc.file_type === 'pdf' ? (
            <iframe
              key={selectedDocId}
              src={getDocViewUrl(selectedDocId)}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title={selectedDoc.name}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: 16,
                padding: 24,
              }}
            >
              <Text type="secondary" style={{ textAlign: 'center' }}>
                {selectedDoc.file_type.toUpperCase()} 文件暂不支持在线预览
              </Text>
              <Button
                type="primary"
                href={getDocViewUrl(selectedDocId)}
                target="_blank"
              >
                下载查看
              </Button>
            </div>
          )
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: isDark ? '#888' : '#999',
            }}
          >
            <Text type="secondary">请选择一个文档</Text>
          </div>
        )}
      </div>
    </div>
  )
}

// 使用 React.memo 隔离渲染, 不随外部语料变化刷新
const DocumentViewer = React.memo(DocumentViewerInner)
export default DocumentViewer
