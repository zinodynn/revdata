import { KeyOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons'
import { Button, message, Modal, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { itemsApi } from '../services/api'

interface MarkedItemsModalProps {
  open: boolean
  onClose: () => void
  datasetId: number
  onGenerateAuthCode: (ids: number[]) => void
  onDelegate: (ids: number[]) => void
}

export default function MarkedItemsModal({
  open,
  onClose,
  datasetId,
  onGenerateAuthCode,
  onDelegate,
}: MarkedItemsModalProps) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const fetchMarkedItems = async () => {
    setLoading(true)
    try {
      // Fetch all marked items (limit 1000 for now)
      const res = await itemsApi.list(datasetId, 1, 1000, undefined, true)
      setItems(res.data.items)
    } catch (error) {
      message.error('获取标记语料失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && datasetId) {
      fetchMarkedItems()
      setSelectedRowKeys([])
    }
  }, [open, datasetId])

  const handleGenerate = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请至少选择一条语料')
      return
    }
    onGenerateAuthCode(selectedRowKeys as number[])
    onClose()
  }

  const handleDelegate = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请至少选择一条语料')
      return
    }
    onDelegate(selectedRowKeys as number[])
    onClose()
  }

  const columns = [
    {
      title: '序号',
      dataIndex: 'seq_num',
      key: 'seq_num',
      width: 80,
      sorter: (a: any, b: any) => a.seq_num - b.seq_num,
    },
    {
      title: '原始内容',
      dataIndex: 'original_content',
      key: 'original_content',
      ellipsis: true,
      render: (text: any) => JSON.stringify(text),
    },
    {
      title: '当前内容',
      dataIndex: 'current_content',
      key: 'current_content',
      ellipsis: true,
      render: (text: any) => JSON.stringify(text),
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_: any, record: any) => {
        if (record.is_marked) {
          return <Tag color="purple">标记待定</Tag>
        }
        const colors: Record<string, string> = {
          pending: 'default',
          approved: 'success',
          rejected: 'error',
          modified: 'warning',
        }
        const labels: Record<string, string> = {
          pending: '待审核',
          approved: '已通过',
          rejected: '已拒绝',
          modified: '已修改',
        }
        return <Tag color={colors[record.status]}>{labels[record.status]}</Tag>
      },
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }

  return (
    <Modal
      title="标记语料列表"
      open={open}
      onCancel={onClose}
      width={800}
      footer={[
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          onClick={fetchMarkedItems}
          loading={loading}
        >
          刷新
        </Button>,
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="delegate"
          icon={<SendOutlined />}
          onClick={handleDelegate}
          disabled={selectedRowKeys.length === 0}
        >
          委派给用户 ({selectedRowKeys.length})
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<KeyOutlined />}
          onClick={handleGenerate}
          disabled={selectedRowKeys.length === 0}
        >
          生成授权码 ({selectedRowKeys.length})
        </Button>,
      ]}
    >
      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        size="small"
      />
    </Modal>
  )
}
