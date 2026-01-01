import {
  CheckCircleOutlined,
  KeyOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthCodeModal from '../components/AuthCodeModal'
import { tasksApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

interface Task {
  id: number
  dataset_id: number
  dataset_name?: string
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
  const [authCodeModalOpen, setAuthCodeModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const navigate = useNavigate()
  useAuthStore() // 保持store订阅

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const res = await tasksApi.myTasks()
      setTasks(res.data.items || res.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  // 进入纯净审核页面
  const startReview = (task: Task) => {
    // 如果是离散的任务(item_ids)，目前ReviewPageV2主要支持seq导航，
    // 但我们可以传入seq=item_start作为入口，或者后续改进ReviewPageV2支持任务ID
    // 暂时先跳转到起始序号
    navigate(`/datasets/${task.dataset_id}/review?seq=${task.item_start}`)
  }

  // 打开授权码管理
  const openAuthCode = (task: Task) => {
    setSelectedTask(task)
    setAuthCodeModalOpen(true)
  }

  // 统计数据
  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    totalItems: tasks.reduce((sum, t) => sum + t.total_items, 0),
    reviewedItems: tasks.reduce((sum, t) => sum + t.reviewed_items, 0),
  }

  const columns = [
    {
      title: '数据集',
      key: 'dataset',
      render: (_: any, record: Task) => (
        <div>
          <Text strong>{record.dataset_name || `数据集 #${record.dataset_id}`}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            #{record.item_start} - #{record.item_end}
          </Text>
        </div>
      ),
    },
    {
      title: '进度',
      render: (_: any, record: Task) => (
        <Progress
          percent={Math.round((record.reviewed_items / record.total_items) * 100)}
          size="small"
          strokeColor={record.reviewed_items === record.total_items ? '#52c41a' : '#1890ff'}
          format={() => `${record.reviewed_items}/${record.total_items}`}
        />
      ),
      width: 180,
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
      title: '备注',
      dataIndex: 'note',
      ellipsis: true,
      width: 150,
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, record: Task) => (
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => startReview(record)}
            disabled={record.status === 'completed'}
          >
            开始审核
          </Button>
          <Button
            icon={<KeyOutlined />}
            onClick={() => openAuthCode(record)}
            title="生成授权码委派他人审核"
          >
            授权码
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="总任务" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="待处理" value={stats.pending} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="审核进度"
              value={
                stats.totalItems > 0
                  ? Math.round((stats.reviewedItems / stats.totalItems) * 100)
                  : 0
              }
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              我的清单
            </Title>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchTasks}>
            刷新
          </Button>
        }
      >
        {tasks.length === 0 && !loading ? (
          <Empty
            image={<CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />}
            description={
              <div>
                <Text style={{ fontSize: 16 }}>暂无待处理的任务</Text>
                <br />
                <Text type="secondary">等待管理员分配新的审核任务</Text>
              </div>
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={tasks}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            onRow={(record) => ({
              style: { cursor: 'pointer' },
              onDoubleClick: () => startReview(record),
            })}
          />
        )}
      </Card>

      {/* 授权码管理弹窗 */}
      {selectedTask && (
        <AuthCodeModal
          open={authCodeModalOpen}
          onClose={() => setAuthCodeModalOpen(false)}
          datasetId={selectedTask.dataset_id}
          itemStart={selectedTask.item_start}
          itemEnd={selectedTask.item_end}
        />
      )}
    </div>
  )
}
