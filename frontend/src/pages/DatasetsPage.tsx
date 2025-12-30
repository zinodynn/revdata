import { ExportOutlined, EyeOutlined, KeyOutlined, MoreOutlined, PlusOutlined, SendOutlined, SettingOutlined, UploadOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  message,
  Modal,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthCodeModal from '../components/AuthCodeModal'
import DelegateModal from '../components/DelegateModal'
import FieldMappingConfig, { FieldMapping, ReviewConfig } from '../components/FieldMappingConfig'
import { datasetsApi } from '../services/api'

const { Title } = Typography

interface Dataset {
  id: number
  name: string
  description: string
  format: string
  item_count: number
  status: string
  created_at: string
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

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [detectedFields, setDetectedFields] = useState<string[]>([])
  const [sampleData, setSampleData] = useState<any[]>([])
  const [suggestedMapping, setSuggestedMapping] = useState<FieldMapping | null>(null)
  const [fieldMapping, setFieldMapping] = useState<FieldMapping | null>(null)
  const [reviewConfig, setReviewConfig] = useState<ReviewConfig | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [authCodeModalOpen, setAuthCodeModalOpen] = useState(false)
  const [delegateModalOpen, setDelegateModalOpen] = useState(false)
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const fetchDatasets = async () => {
    setLoading(true)
    try {
      const res = await datasetsApi.list()
      setDatasets(res.data.items)
    } catch (error) {
      message.error('获取数据集失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDatasets()
  }, [])

  const handleUpload = async (values: any) => {
    if (!selectedFile) {
      message.error('请选择文件')
      return
    }

    setUploading(true)
    try {
      const res = await datasetsApi.upload(selectedFile, values.name, values.description)
      const datasetId = res.data.id

      // 如果有字段映射配置，更新数据集
      if (fieldMapping) {
        await datasetsApi.update(datasetId, {
          field_mapping: fieldMapping,
          review_config: reviewConfig || undefined,
        })
      }

      message.success('上传成功')
      handleCloseModal()
      fetchDatasets()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)
    setDetecting(true)
    try {
      const res = await datasetsApi.detectFields(file)
      setDetectedFields(res.data.detected_fields)
      setSampleData(res.data.sample_data)
      setSuggestedMapping(res.data.suggested_mapping)
      setFieldMapping(res.data.suggested_mapping)
      setCurrentStep(1)
    } catch (error: any) {
      message.error(error.response?.data?.detail || '文件解析失败')
    } finally {
      setDetecting(false)
    }
    return false
  }

  const handleCloseModal = () => {
    setUploadModalOpen(false)
    setCurrentStep(0)
    setSelectedFile(null)
    setDetectedFields([])
    setSampleData([])
    setSuggestedMapping(null)
    setFieldMapping(null)
    setReviewConfig(null)
    form.resetFields()
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
    },
    {
      title: '格式',
      dataIndex: 'format',
      width: 100,
      render: (format: string) => <Tag>{format.toUpperCase()}</Tag>,
    },
    {
      title: '条目数',
      dataIndex: 'item_count',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status]}>{statusLabels[status] || status}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      width: 220,
      render: (_: any, record: Dataset) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/datasets/${record.id}/review`)}
          >
            预览
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SendOutlined />}
            onClick={() => {
              setSelectedDatasetId(record.id)
              setDelegateModalOpen(true)
            }}
          >
            委派
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'auth_code',
                  icon: <KeyOutlined />,
                  label: '生成授权码',
                  onClick: () => {
                    setSelectedDatasetId(record.id)
                    setAuthCodeModalOpen(true)
                  },
                },
                {
                  key: 'detail',
                  icon: <SettingOutlined />,
                  label: '配置',
                  onClick: () => navigate(`/datasets/${record.id}`),
                },
                {
                  key: 'export',
                  icon: <ExportOutlined />,
                  label: '导出',
                  onClick: () => navigate(`/datasets/${record.id}`),
                },
              ],
            }}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          数据集列表
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadModalOpen(true)}>
          上传数据集
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={datasets}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <AuthCodeModal
        open={authCodeModalOpen}
        onClose={() => setAuthCodeModalOpen(false)}
        datasetId={selectedDatasetId || 0}
      />

      <DelegateModal
        open={delegateModalOpen}
        onClose={() => setDelegateModalOpen(false)}
        datasetId={selectedDatasetId || 0}
        currentItemSeq={1}
        totalItems={datasets.find(d => d.id === selectedDatasetId)?.item_count || 0}
      />

      <Modal
        title="上传数据集"
        open={uploadModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Steps
          current={currentStep}
          style={{ marginBottom: 24 }}
          items={[
            { title: '选择文件' },
            { title: '配置字段映射' },
            { title: '确认上传' },
          ]}
        />

        {currentStep === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            {detecting ? (
              <Spin tip="正在解析文件..." />
            ) : (
              <Upload.Dragger
                beforeUpload={handleFileSelect}
                showUploadList={false}
                accept=".jsonl,.json,.csv,.tsv"
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此处</p>
                <p className="ant-upload-hint">支持 JSONL、JSON、CSV、TSV 格式</p>
              </Upload.Dragger>
            )}
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Tag color="blue">{selectedFile?.name}</Tag>
              <Button type="link" onClick={() => setCurrentStep(0)}>
                重新选择
              </Button>
            </div>
            <FieldMappingConfig
              detectedFields={detectedFields}
              sampleData={sampleData}
              initialMapping={suggestedMapping || undefined}
              onChange={(mapping, config) => {
                setFieldMapping(mapping)
                setReviewConfig(config)
              }}
              showPreview
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setCurrentStep(0)}>上一步</Button>
                <Button type="primary" onClick={() => setCurrentStep(2)}>
                  下一步
                </Button>
              </Space>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <Form form={form} layout="vertical" onFinish={handleUpload}>
            <Form.Item
              name="name"
              label="数据集名称"
              rules={[{ required: true }]}
              initialValue={selectedFile?.name.replace(/\.[^/.]+$/, '')}
            >
              <Input placeholder="请输入数据集名称" />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea placeholder="可选描述" rows={3} />
            </Form.Item>
            <Card size="small" title="字段映射预览" style={{ marginBottom: 16 }}>
              <Space wrap>
                {fieldMapping?.question_field && (
                  <Tag color="blue">问题: {fieldMapping.question_field}</Tag>
                )}
                {fieldMapping?.answer_field && (
                  <Tag color="green">回答: {fieldMapping.answer_field}</Tag>
                )}
                {fieldMapping?.thinking_field && (
                  <Tag color="gold">思考: {fieldMapping.thinking_field}</Tag>
                )}
                {fieldMapping?.display_mode && (
                  <Tag>模式: {fieldMapping.display_mode}</Tag>
                )}
              </Space>
            </Card>
            <Form.Item>
              <Space>
                <Button onClick={() => setCurrentStep(1)}>上一步</Button>
                <Button type="primary" htmlType="submit" loading={uploading}>
                  确认上传
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
