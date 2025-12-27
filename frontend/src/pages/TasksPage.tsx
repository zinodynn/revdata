import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, Tag, Button, Progress, Typography, Space } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { tasksApi } from '../services/api'

const { Title } = Typography

interface Task {
  id: number
  dataset_id: number
  item_start: number
  item_end: number
  status: string
  priority: number
  note: string
  total_items: number
  reviewed_items: number
  created_at: string
}

const statusColors: Record<string, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  delegated: 'warning',
}

const statusLabels: Record<string, string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  delegated: '已委派',
}

const priorityLabels: Record<number, { text: string; color: string }> = {
  0: { text: '普通', color: 'default' },
  1: { text: '高', color: 'orange' },
  2: { text: '紧急', color: 'red' },
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const res = await tasksApi.myTasks()
      setTasks(res.data.items)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '数据集',
      dataIndex: 'dataset_id',
      width: 100,
    },
    {
      title: '范围',
      render: (_: any, record: Task) => `#${record.item_start} - #${record.item_end}`,
      width: 150,
    },
    {
      title: '进度',
      render: (_: any, record: Task) => (
        <Progress
          percent={Math.round((record.reviewed_items / record.total_items) * 100)}
          size="small"
          format={() => `${record.reviewed_items}/${record.total_items}`}
        />
      ),
      width: 200,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: (priority: number) => (
        <Tag color={priorityLabels[priority]?.color}>{priorityLabels[priority]?.text}</Tag>
      ),
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
      width: 150,
      render: (_: any, record: Task) => (
        <Space>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => navigate(`/datasets/${record.dataset_id}/review`)}
            disabled={record.status === 'completed'}
          >
            审核
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        我的任务
      </Title>

      <Card>
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  )
}
