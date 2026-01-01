import { CopyOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons'
import {
  Button,
  DatePicker,
  Form,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { shareApi } from '../services/api'

interface ShareModalProps {
  open: boolean
  onClose: () => void
  datasetId: number
}

interface ShareLink {
  id: number
  token: string
  permission: string
  expires_at: string | null
  max_access_count: number | null
  access_count: number
  is_active: boolean
  created_at: string
  share_url?: string
}

const permissionLabels: Record<string, { text: string; color: string }> = {
  view: { text: '仅查看', color: 'default' },
  comment: { text: '可评论', color: 'blue' },
  edit: { text: '可编辑', color: 'green' },
}

export default function ShareModal({ open, onClose, datasetId }: ShareModalProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [links, setLinks] = useState<ShareLink[]>([])
  const [creating, setCreating] = useState(false)

  const fetchLinks = async () => {
    if (!datasetId) return
    setLoading(true)
    try {
      const res = await shareApi.list(datasetId)
      setLinks(res.data)
    } catch (error) {
      message.error('获取分享链接失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && datasetId) {
      fetchLinks()
    }
  }, [open, datasetId])

  const handleCreate = async (values: any) => {
    setCreating(true)
    try {
      const data: any = {
        dataset_id: datasetId,
        permission: values.permission,
      }
      if (values.expires_at) {
        data.expires_at = values.expires_at.toISOString()
      }
      if (values.max_access_count) {
        data.max_access_count = values.max_access_count
      }

      const res = await shareApi.create(data)
      message.success('创建成功')

      // 复制链接到剪贴板
      const shareUrl = `${window.location.origin}/share/${res.data.token}`
      navigator.clipboard.writeText(shareUrl)
      message.info('链接已复制到剪贴板')

      form.resetFields()
      fetchLinks()
    } catch (error) {
      message.error('创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await shareApi.delete(id)
      message.success('已禁用')
      fetchLinks()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(url)
    message.success('链接已复制')
  }

  const columns = [
    {
      title: '权限',
      dataIndex: 'permission',
      width: 100,
      render: (p: string) => (
        <Tag color={permissionLabels[p]?.color}>{permissionLabels[p]?.text}</Tag>
      ),
    },
    {
      title: '访问次数',
      dataIndex: 'access_count',
      width: 100,
      render: (count: number, record: ShareLink) =>
        record.max_access_count ? `${count}/${record.max_access_count}` : count,
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      width: 150,
      render: (date: string | null) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '永不过期'),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (active: boolean) =>
        active ? <Tag color="green">有效</Tag> : <Tag color="red">已禁用</Tag>,
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, record: ShareLink) => (
        <Space>
          <Tooltip title="复制链接">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyLink(record.token)}
              disabled={!record.is_active}
            />
          </Tooltip>
          <Tooltip title="禁用">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
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
          <LinkOutlined /> 分享管理
        </>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      {/* 创建新链接 */}
      <Form form={form} layout="inline" onFinish={handleCreate} style={{ marginBottom: 24 }}>
        <Form.Item name="permission" initialValue="view" label="权限">
          <Select style={{ width: 120 }}>
            <Select.Option value="view">仅查看</Select.Option>
            <Select.Option value="comment">可评论</Select.Option>
            <Select.Option value="edit">可编辑</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="expires_at" label="过期时间">
          <DatePicker showTime placeholder="永不过期" />
        </Form.Item>
        <Form.Item name="max_access_count" label="访问上限">
          <InputNumber min={1} placeholder="无限制" style={{ width: 100 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={creating}>
            创建链接
          </Button>
        </Form.Item>
      </Form>

      {/* 链接列表 */}
      <Table
        columns={columns}
        dataSource={links}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
      />
    </Modal>
  )
}
