import {
    ArrowLeftOutlined,
    DatabaseOutlined,
    EditOutlined,
    ExportOutlined,
    PlayCircleOutlined,
    SettingOutlined,
} from '@ant-design/icons'
import {
    Alert,
    Breadcrumb,
    Button,
    Card,
    Col,
    Descriptions,
    message,
    Row,
    Space,
    Spin,
    Statistic,
    Tabs,
    Tag,
    Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FieldMappingConfig, { FieldMapping, ReviewConfig } from '../components/FieldMappingConfig'
import { datasetsApi, exportApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'

const { Title } = Typography

interface Dataset {
  id: number
  name: string
  description: string
  format: string
  source_file: string
  item_count: number
  owner_id: number
  status: string
  field_mapping: any
  review_config: any
  created_at: string
  updated_at: string
}

interface PreviewData {
  dataset_id: number
  dataset_name: string
  total_items: number
  detected_fields: string[]
  current_mapping: any
  sample_data: any[]
}

const statusColors: Record<string, string> = {
  importing: 'processing',
  ready: 'success',
  reviewing: 'warning',
  completed: 'green',
  archived: 'default',
}

const statusLabels: Record<string, string> = {
  importing: '导入中',
  ready: '待审核',
  reviewing: '审核中',
  completed: '已完成',
  archived: '已归档',
}

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [_saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    if (id) {
      fetchDataset()
      fetchPreview()
    }
  }, [id])

  const fetchDataset = async () => {
    try {
      const res = await datasetsApi.get(Number(id))
      setDataset(res.data)
    } catch (error) {
      message.error('获取数据集失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchPreview = async () => {
    try {
      const res = await datasetsApi.preview(Number(id), 5)
      setPreviewData(res.data)
    } catch (error) {
      console.error('获取预览数据失败', error)
    }
  }

  const handleSaveConfig = async (mapping: FieldMapping, reviewConfig: ReviewConfig) => {
    if (!dataset) return
    setSaving(true)
    try {
      await datasetsApi.update(dataset.id, {
        field_mapping: mapping,
        review_config: reviewConfig,
      })
      message.success('配置保存成功')
      fetchDataset()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async (format: string) => {
    if (!dataset) return
    setExporting(true)
    try {
      const res = await exportApi.download(dataset.id, {
        format,
        include_original: true,
      })
      const blob = new Blob([res.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${dataset.name}_export.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!dataset) {
    return (
      <Alert
        message="数据集不存在"
        type="error"
        showIcon
        action={
          <Button onClick={() => navigate('/datasets')}>返回列表</Button>
        }
      />
    )
  }

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <DatabaseOutlined />
          概览
        </span>
      ),
      children: (
        <div>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title="总条目数" value={dataset.item_count} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="文件格式" value={dataset.format.toUpperCase()} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="状态"
                  valueRender={() => (
                    <Tag color={statusColors[dataset.status]}>
                      {statusLabels[dataset.status] || dataset.status}
                    </Tag>
                  )}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="创建时间"
                  value={new Date(dataset.created_at).toLocaleDateString()}
                />
              </Card>
            </Col>
          </Row>

          <Card title="数据集信息">
            <Descriptions column={2}>
              <Descriptions.Item label="名称">{dataset.name}</Descriptions.Item>
              <Descriptions.Item label="ID">{dataset.id}</Descriptions.Item>
              <Descriptions.Item label="源文件">{dataset.source_file}</Descriptions.Item>
              <Descriptions.Item label="格式">{dataset.format}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {dataset.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(dataset.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(dataset.updated_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 当前字段映射摘要 */}
          {dataset.field_mapping && (
            <Card title="当前字段映射" style={{ marginTop: 16 }}>
              <Space wrap>
                {dataset.field_mapping.question_field && (
                  <Tag color="blue">问题: {dataset.field_mapping.question_field}</Tag>
                )}
                {dataset.field_mapping.answer_field && (
                  <Tag color="green">回答: {dataset.field_mapping.answer_field}</Tag>
                )}
                {dataset.field_mapping.thinking_field && (
                  <Tag color="gold">思考: {dataset.field_mapping.thinking_field}</Tag>
                )}
                {dataset.field_mapping.context_field && (
                  <Tag color="purple">上下文: {dataset.field_mapping.context_field}</Tag>
                )}
                {dataset.field_mapping.messages_field && (
                  <Tag color="cyan">消息: {dataset.field_mapping.messages_field}</Tag>
                )}
                <Tag>模式: {dataset.field_mapping.display_mode}</Tag>
              </Space>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'config',
      label: (
        <span>
          <SettingOutlined />
          字段映射配置
        </span>
      ),
      children: previewData ? (
        <FieldMappingConfig
          detectedFields={previewData.detected_fields}
          sampleData={previewData.sample_data}
          initialMapping={dataset.field_mapping}
          initialReviewConfig={dataset.review_config}
          onSave={handleSaveConfig}
          readOnly={!isAdmin}
        />
      ) : (
        <Spin />
      ),
    },
  ]

  return (
    <div>
      <Breadcrumb
        items={[
          { title: <a onClick={() => navigate('/datasets')}>数据集</a> },
          { title: dataset.name },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/datasets')}
            />
            <Title level={4} style={{ margin: 0 }}>
              {dataset.name}
            </Title>
            <Tag color={statusColors[dataset.status]}>
              {statusLabels[dataset.status] || dataset.status}
            </Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<PlayCircleOutlined />}
              type="primary"
              onClick={() => navigate(`/datasets/${dataset.id}/review`)}
            >
              开始审核
            </Button>
            <Button
              icon={<ExportOutlined />}
              loading={exporting}
              onClick={() => handleExport('jsonl')}
            >
              导出 JSONL
            </Button>
            {isAdmin && (
              <Button
                icon={<EditOutlined />}
                onClick={() => setActiveTab('config')}
              >
                配置映射
              </Button>
            )}
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>
    </div>
  )
}
