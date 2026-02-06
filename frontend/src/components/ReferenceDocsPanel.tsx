import {
  DeleteOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Button, List, message, Popconfirm, Space, Spin, Tag, Typography, Upload } from 'antd'
import { useEffect, useState } from 'react'
import { referenceDocsApi } from '../services/api'

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

interface ReferenceDocsPanelProps {
  datasetId: number
  readOnly?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(fileType: string) {
  switch (fileType) {
    case 'pdf':
      return <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
    case 'doc':
    case 'docx':
      return <FileWordOutlined style={{ fontSize: 24, color: '#1890ff' }} />
    default:
      return <FileOutlined style={{ fontSize: 24 }} />
  }
}

export default function ReferenceDocsPanel({ datasetId, readOnly = false }: ReferenceDocsPanelProps) {
  const [docs, setDocs] = useState<ReferenceDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchDocs = async () => {
    setLoading(true)
    try {
      const res = await referenceDocsApi.list(datasetId)
      setDocs(res.data.items)
    } catch {
      message.error('获取参考文档列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (datasetId) fetchDocs()
  }, [datasetId])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      await referenceDocsApi.upload(datasetId, file)
      message.success('文档上传成功')
      fetchDocs()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '上传失败')
    } finally {
      setUploading(false)
    }
    return false
  }

  const handleDelete = async (docId: number) => {
    try {
      await referenceDocsApi.delete(docId)
      message.success('文档已删除')
      fetchDocs()
    } catch {
      message.error('删除失败')
    }
  }

  return (
    <div>
      {!readOnly && (
        <div style={{ marginBottom: 16 }}>
          <Upload
            beforeUpload={handleUpload}
            showUploadList={false}
            accept=".pdf,.doc,.docx"
          >
            <Button icon={<UploadOutlined />} loading={uploading}>
              上传参考文档
            </Button>
          </Upload>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            支持 PDF、DOC、DOCX 格式
          </Text>
        </div>
      )}

      <Spin spinning={loading}>
        <List
          dataSource={docs}
          locale={{ emptyText: '暂无参考文档' }}
          renderItem={(doc) => (
            <List.Item
              actions={
                !readOnly
                  ? [
                      <Popconfirm
                        key="delete"
                        title="确定删除此文档？"
                        onConfirm={() => handleDelete(doc.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                      </Popconfirm>,
                    ]
                  : []
              }
            >
              <List.Item.Meta
                avatar={getFileIcon(doc.file_type)}
                title={
                  <Space>
                    <span>{doc.name}</span>
                    <Tag>{doc.file_type.toUpperCase()}</Tag>
                  </Space>
                }
                description={
                  <Space>
                    <Text type="secondary">{formatFileSize(doc.file_size)}</Text>
                    <Text type="secondary">
                      {new Date(doc.created_at).toLocaleString()}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Spin>
    </div>
  )
}
