import {
    CopyOutlined,
    DeleteOutlined,
    EyeOutlined,
    KeyOutlined,
    ReloadOutlined,
} from '@ant-design/icons'
import {
    Button,
    Card,
    Col,
    DatePicker,
    Form,
    InputNumber,
    message,
    Modal,
    Row,
    Space,
    Statistic,
    Table,
    Tag,
    Tooltip,
    Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { authCodeApi } from '../services/api'

const { Text } = Typography

interface AuthCodeModalProps {
  open: boolean
  onClose: () => void
  datasetId: number
  itemStart?: number
  itemEnd?: number
}

interface AuthCode {
  id: number
  code: string
  dataset_id: number
  item_start: number
  item_end: number
  permission: string
  expires_at: string | null
  max_online: number
  current_online: number
  max_verify_count: number
  verify_count: number
  is_active: boolean
  created_at: string
  reviewed_count: number
}

export default function AuthCodeModal({
  open,
  onClose,
  datasetId,
  itemStart = 1,
  itemEnd = 100,
}: AuthCodeModalProps) {
  const [form] = Form.useForm()
  const [codes, setCodes] = useState<AuthCode[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const fetchCodes = async () => {
    setLoading(true)
    try {
      const res = await authCodeApi.list(datasetId)
      setCodes(res.data)
    } catch (error) {
      message.error('获取授权码列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && datasetId) {
      fetchCodes()
      form.setFieldsValue({
        item_start: itemStart,
        item_end: itemEnd,
      })
    }
  }, [open, datasetId])

  const handleCreate = async (values: any) => {
    setCreating(true)
    try {
      const data: any = {
        dataset_id: datasetId,
        item_start: values.item_start,
        item_end: values.item_end,
        max_online: values.max_online || 1,
        max_verify_count: values.max_verify_count || 10,
      }
      if (values.expires_at) {
        data.expires_at = values.expires_at.toISOString()
      }

      const res = await authCodeApi.create(data)
      message.success(`授权码已创建: ${res.data.code}`)

      // 复制授权码
      const codeUrl = `${window.location.origin}/auth/${res.data.code}`
      navigator.clipboard.writeText(codeUrl)
      message.info('授权链接已复制到剪贴板')

      setShowCreate(false)
      form.resetFields()
      fetchCodes()
    } catch (error) {
      message.error('创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: number) => {
    try {
      await authCodeApi.revoke(id)
      message.success('已撤销')
      fetchCodes()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const copyCode = (code: string) => {
    const url = `${window.location.origin}/auth/${code}`
    navigator.clipboard.writeText(url)
    message.success('授权链接已复制')
  }

  const columns = [
    {
      title: '授权码',
      dataIndex: 'code',
      width: 100,
      render: (code: string) => (
        <Text strong style={{ fontFamily: 'monospace', fontSize: 16 }}>
          {code}
        </Text>
      ),
    },
    {
      title: '审核范围',
      key: 'range',
      width: 120,
      render: (_: any, record: AuthCode) => (
        <Text>
          #{record.item_start} - #{record.item_end}
        </Text>
      ),
    },
    {
      title: '在线数',
      key: 'online',
      width: 100,
      render: (_: any, record: AuthCode) => (
        <span>
          {record.current_online}/{record.max_online}
        </span>
      ),
    },
    {
      title: '验证次数',
      key: 'verify',
      width: 100,
      render: (_: any, record: AuthCode) => (
        <span>
          {record.verify_count}/{record.max_verify_count}
        </span>
      ),
    },
    {
      title: '已审核',
      dataIndex: 'reviewed_count',
      width: 80,
      render: (count: number) => <Tag color="blue">{count}</Tag>,
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      width: 140,
      render: (date: string | null) =>
        date ? dayjs(date).format('MM-DD HH:mm') : '永不过期',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (active: boolean) =>
        active ? <Tag color="green">有效</Tag> : <Tag color="red">已撤销</Tag>,
    },
    {
      title: '操作',
      width: 100,
      render: (_: any, record: AuthCode) => (
        <Space>
          <Tooltip title="复制链接">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyCode(record.code)}
              disabled={!record.is_active}
            />
          </Tooltip>
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => message.info(`已审核 ${record.reviewed_count} 条`)}
            />
          </Tooltip>
          <Tooltip title="撤销">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleRevoke(record.id)}
              disabled={!record.is_active}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <Modal
      title={
        <>
          <KeyOutlined /> 授权码管理
        </>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
    >
      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总授权码" value={codes.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="有效"
              value={codes.filter((c) => c.is_active).length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="当前在线"
              value={codes.reduce((sum, c) => sum + c.current_online, 0)}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已审核"
              value={codes.reduce((sum, c) => sum + c.reviewed_count, 0)}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 创建新授权码 */}
      {showCreate ? (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Form form={form} layout="inline" onFinish={handleCreate}>
            <Form.Item name="item_start" label="起始" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: 80 }} />
            </Form.Item>
            <Form.Item name="item_end" label="结束" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: 80 }} />
            </Form.Item>
            <Form.Item name="max_online" label="最大在线" initialValue={1}>
              <InputNumber min={1} max={10} style={{ width: 70 }} />
            </Form.Item>
            <Form.Item name="max_verify_count" label="验证上限" initialValue={10}>
              <InputNumber min={1} max={100} style={{ width: 70 }} />
            </Form.Item>
            <Form.Item name="expires_at" label="过期时间">
              <DatePicker showTime format="YYYY-MM-DD HH:mm" />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={creating}>
                  生成
                </Button>
                <Button onClick={() => setShowCreate(false)}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      ) : (
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<KeyOutlined />} onClick={() => setShowCreate(true)}>
            生成授权码
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchCodes}>
            刷新
          </Button>
        </Space>
      )}

      {/* 授权码列表 */}
      <Table
        columns={columns}
        dataSource={codes}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 5 }}
      />
    </Modal>
  )
}
