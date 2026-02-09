import { BookOutlined, CloseOutlined, FileImageOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons'
import { Button, Space, Tooltip, Typography } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { referenceDocsApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import './DocumentViewer.css'
import DocxPreview from './DocxPreview'

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
  onExpandChange?: (expanded: boolean) => void
}

/**
 * 审核页面右侧文档查看面板
 * - 独立状态管理，不随语料切换刷新
 * - 支持拖拽调整宽度
 * - 使用 iframe 渲染 PDF
 */
function DocumentViewerInner({ datasetId, theme = 'light', onExpandChange }: DocumentViewerProps) {
  const isDark = theme === 'dark'
  const [expanded, setExpanded] = useState(false)
  const [docs, setDocs] = useState<ReferenceDoc[]>([])
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null)
  const [panelWidth, setPanelWidth] = useState(() => Math.floor(window.innerWidth * 0.5)) // 默认半屏
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // 通知父组件展开状态变化
  const handleExpandChange = (newExpanded: boolean) => {
    setExpanded(newExpanded)
    onExpandChange?.(newExpanded)
  }

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

  // 获取文件图标
  const getFileIcon = (fileType: string) => {
    if (fileType === 'pdf') return <FilePdfOutlined />
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileType.toLowerCase())) {
      return <FileImageOutlined />
    }
    return <FileTextOutlined />
  }

  // 截断文件名
  const truncateName = (name: string, maxLen = 12) => {
    if (name.length <= maxLen) return name
    return name.slice(0, maxLen) + '...'
  }

  // 收起状态: 侧边 tab 形式的切换按钮
  if (!expanded) {
    return (
      <Tooltip title="查看参考文档" placement="left">
        <div
          className="doc-viewer-toggle-tab"
          onClick={() => handleExpandChange(true)}
          style={{
            position: 'fixed',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000,
            background: isDark ? '#1f1f1f' : '#1890ff',
            color: '#fff',
            padding: '12px 8px',
            borderTopLeftRadius: 8,
            borderBottomLeftRadius: 8,
            cursor: 'pointer',
            boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            writingMode: 'vertical-rl',
            fontSize: 14,
            fontWeight: 500,
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.paddingLeft = '12px'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.paddingLeft = '8px'
          }}
        >
          <BookOutlined style={{ marginBottom: 4, fontSize: 16 }} />
          <span style={{ fontSize: 12 }}>参考文档</span>
        </div>
      </Tooltip>
    )
  }

  // 展开状态
  return (
    <div
      style={{
        width: panelWidth,
        height: 'calc(100vh - 0px)',
        position: 'fixed',
        right: 0,
        top: 0,
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        background: isDark ? '#1f1f1f' : '#fff',
        borderLeft: isDark ? '1px solid #434343' : '1px solid #d9d9d9',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
        boxSizing: 'border-box',
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
          padding: '8px 12px',
          borderBottom: isDark ? '1px solid #434343' : '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          boxSizing: 'border-box',
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
          onClick={() => handleExpandChange(false)}
        />
      </div>

      {/* 文档查看区域 */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', boxSizing: 'border-box' }}>
        {selectedDocId && selectedDoc ? (
          // PDF 和 Word（后端自动转 PDF）都用 iframe 查看
          // 优先尝试 PDF（后端转换成功时）
          selectedDoc.file_type === 'pdf' ? (
            <iframe
              key={selectedDocId}
              src={getDocViewUrl(selectedDocId)}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
              title={selectedDoc.name}
            />
          ) : ['doc','docx'].includes(selectedDoc.file_type) ? (
            <DocxPreview docId={selectedDocId} name={selectedDoc.name} getUrl={getDocViewUrl} />
          ) : ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(selectedDoc.file_type.toLowerCase()) ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                background: isDark ? '#141414' : '#f5f5f5',
                boxSizing: 'border-box',
              }}
            >
              <img
                src={getDocViewUrl(selectedDocId)}
                alt={selectedDoc.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
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

      {/* 底部文档标签页选择器 */}
      <div
        style={{
          borderTop: isDark ? '1px solid #434343' : '1px solid #f0f0f0',
          background: isDark ? '#141414' : '#fafafa',
          padding: '6px 8px',
          overflowX: 'auto',
          overflowY: 'hidden',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <Space size={8}>
          {docs.map((doc) => (
            <Tooltip key={doc.id} title={doc.name} placement="top">
              <div
                onClick={() => setSelectedDocId(doc.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: selectedDocId === doc.id
                    ? (isDark ? '#1890ff' : '#1890ff')
                    : (isDark ? '#2a2a2a' : '#fff'),
                  color: selectedDocId === doc.id ? '#fff' : (isDark ? '#e8e8e8' : '#333'),
                  border: selectedDocId === doc.id
                    ? 'none'
                    : (isDark ? '1px solid #434343' : '1px solid #d9d9d9'),
                  transition: 'all 0.2s ease',
                  fontSize: 13,
                }}
                onMouseEnter={(e) => {
                  if (selectedDocId !== doc.id) {
                    e.currentTarget.style.background = isDark ? '#333' : '#f5f5f5'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedDocId !== doc.id) {
                    e.currentTarget.style.background = isDark ? '#2a2a2a' : '#fff'
                  }
                }}
              >
                {getFileIcon(doc.file_type)}
                <span>{truncateName(doc.name)}</span>
              </div>
            </Tooltip>
          ))}
        </Space>
      </div>
    </div>
  )
}

// 使用 React.memo 隔离渲染, 不随外部语料变化刷新
const DocumentViewer = React.memo(DocumentViewerInner)
export default DocumentViewer
