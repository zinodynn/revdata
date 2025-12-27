import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  Button,
  Card,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Upload,
  message,
  Typography,
} from 'antd'
import { PlusOutlined, UploadOutlined, EyeOutlined } from '@ant-design/icons'
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
    const file = values.file?.fileList?.[0]?.originFileObj
    if (!file) {
      message.error('请选择文件')
      return
    }

    setUploading(true)
    try {
      await datasetsApi.upload(file, values.name, values.description)
      message.success('上传成功')
      setUploadModalOpen(false)
      form.resetFields()
      fetchDatasets()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '上传失败')
    } finally {
      setUploading(false)
    }
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
      width: 120,
      render: (_: any, record: Dataset) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/datasets/${record.id}/review`)}
        >
          审核
        </Button>
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

      <Modal
        title="上传数据集"
        open={uploadModalOpen}
        onCancel={() => setUploadModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item name="name" label="数据集名称" rules={[{ required: true }]}>
            <Input placeholder="请输入数据集名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="可选描述" rows={3} />
          </Form.Item>
          <Form.Item
            name="file"
            label="数据文件"
            rules={[{ required: true, message: '请上传文件' }]}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".jsonl,.json,.csv,.tsv">
              <Button icon={<UploadOutlined />}>选择文件 (JSONL/JSON/CSV/TSV)</Button>
            </Upload>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={uploading}>
                上传
              </Button>
              <Button onClick={() => setUploadModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
