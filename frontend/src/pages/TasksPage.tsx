import {
  CheckCircleOutlined,
  KeyOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
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
  assignee_name?: string
  reviewed_by_assigner?: boolean
  status_counts?: {
    pending?: number
    approved?: number
    modified?: number
    rejected?: number
  }
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
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [authCodeModalOpen, setAuthCodeModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [activeTab, setActiveTab] = useState('pending')
  const navigate = useNavigate()
  useAuthStore() // 保持store订阅

  const fetchMyTasks = async () => {
    setLoading(true)
    try {
      const res = await tasksApi.myTasks()
      setMyTasks(res.data.items || res.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAssignedTasks = async () => {
    setLoading(true)
    try {
      const res = await tasksApi.assignedByMe()
      setAssignedTasks(res.data.items || res.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMyTasks()
    fetchAssignedTasks()
  }, [])

  // 进入纯净审核页面
  const startReview = (task: Task) => {
    // 传入 taskId 以便 ReviewPageV2 进行任务范围过滤
    // 同时传入 seq=1 作为初始位置 (相对于任务的索引)
    navigate(`/datasets/${task.dataset_id}/review?taskId=${task.id}&seq=1`)
  }

  // 预览已完成任务（派发者查看）
  const previewTask = async (task: Task) => {
    // 标记为已查看
    if (task.status === 'completed' && !task.reviewed_by_assigner) {
      try {
        await tasksApi.markReviewed(task.id)
        // 刷新列表
        fetchAssignedTasks()
      } catch (error) {
        console.error('标记任务失败', error)
      }
    }
    // 跳转到审核界面（只读模式）
    navigate(`/datasets/${task.dataset_id}/review?taskId=${task.id}&seq=1`)
  }

  // 打开授权码管理
  const openAuthCode = (task: Task) => {
    setSelectedTask(task)
    setAuthCodeModalOpen(true)
  }

  // 统计数据
  const myStats = {
    total: myTasks.length,
    pending: myTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length,
    completed: myTasks.filter((t) => t.status === 'completed').length,
    totalItems: myTasks.reduce((sum, t) => sum + t.total_items, 0),
    reviewedItems: myTasks.reduce((sum, t) => sum + t.reviewed_items, 0),
  }

  const assignedStats = {
    total: assignedTasks.length,
    pending: assignedTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress')
      .length,
    completed: assignedTasks.filter((t) => t.status === 'completed').length,
    newCompleted: assignedTasks.filter((t) => t.status === 'completed' && !t.reviewed_by_assigner)
      .length,
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
            disabled={record.status === 'completed'}
          >
            授权码
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              审核任务
            </Title>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchMyTasks()
              fetchAssignedTasks()
            }}
          >
            刷新
          </Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'pending',
              label: (
                <span>
                  待完成任务
                  {myStats.pending > 0 && <Badge count={myStats.pending} offset={[10, 0]} />}
                </span>
              ),
              children: (
                <div>
                  {/* 统计卡片 */}
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Card size="small">
                        <Statistic
                          title="待处理"
                          value={myStats.pending}
                          valueStyle={{ color: '#1890ff' }}
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small">
                        <Statistic title="总语料数" value={myStats.totalItems} />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small">
                        <Statistic
                          title="审核进度"
                          value={
                            myStats.totalItems > 0
                              ? Math.round((myStats.reviewedItems / myStats.totalItems) * 100)
                              : 0
                          }
                          suffix="%"
                          valueStyle={{ color: '#722ed1' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  {myTasks.filter((t) => t.status !== 'completed').length === 0 && !loading ? (
                    <Empty
                      image={<CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />}
                      description="暂无待处理的任务"
                    />
                  ) : (
                    <Table
                      columns={columns}
                      dataSource={myTasks.filter((t) => t.status !== 'completed')}
                      rowKey="id"
                      loading={loading}
                      pagination={{ pageSize: 10 }}
                      onRow={(record) => ({
                        style: { cursor: 'pointer' },
                        onDoubleClick: () => startReview(record),
                      })}
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'completed',
              label: '已完成任务',
              children: (
                <div>
                  {myTasks.filter((t) => t.status === 'completed').length === 0 && !loading ? (
                    <Empty description="暂无已完成的任务" />
                  ) : (
                    <Table
                      columns={columns}
                      dataSource={myTasks.filter((t) => t.status === 'completed')}
                      rowKey="id"
                      loading={loading}
                      pagination={{ pageSize: 10 }}
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'assigned',
              label: (
                <span>
                  我派发的任务
                  {assignedStats.newCompleted > 0 && <Badge dot offset={[10, 0]} />}
                </span>
              ),
              children: (
                <div>
                  {/* 统计卡片 */}
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic title="总任务" value={assignedStats.total} />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="进行中"
                          value={assignedStats.pending}
                          valueStyle={{ color: '#1890ff' }}
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic
                          title="已完成"
                          value={assignedStats.completed}
                          valueStyle={{ color: '#52c41a' }}
                        />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Badge dot={assignedStats.newCompleted > 0}>
                          <Statistic
                            title="待查看"
                            value={assignedStats.newCompleted}
                            valueStyle={{ color: '#ff4d4f' }}
                          />
                        </Badge>
                      </Card>
                    </Col>
                  </Row>

                  {assignedTasks.length === 0 && !loading ? (
                    <Empty description="暂无派发的任务" />
                  ) : (
                    <Table
                      columns={[
                        {
                          title: '数据集',
                          key: 'dataset',
                          render: (_: any, record: Task) => (
                            <div>
                              <Text strong>
                                {record.dataset_name || `数据集 #${record.dataset_id}`}
                              </Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                #{record.item_start} - #{record.item_end}
                              </Text>
                            </div>
                          ),
                        },
                        {
                          title: '审核人',
                          dataIndex: 'assignee_name',
                          width: 120,
                        },
                        {
                          title: '进度',
                          render: (_: any, record: Task) => (
                            <Progress
                              percent={Math.round(
                                (record.reviewed_items / record.total_items) * 100,
                              )}
                              size="small"
                              strokeColor={
                                record.reviewed_items === record.total_items ? '#52c41a' : '#1890ff'
                              }
                              format={() => `${record.reviewed_items}/${record.total_items}`}
                            />
                          ),
                          width: 180,
                        },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          width: 100,
                          render: (status: string, record: Task) => (
                            <Space>
                              <Tag color={statusColors[status]}>
                                {statusLabels[status] || status}
                              </Tag>
                              {status === 'completed' && !record.reviewed_by_assigner && (
                                <Badge dot />
                              )}
                            </Space>
                          ),
                        },
                        {
                          title: '备注',
                          dataIndex: 'note',
                          ellipsis: true,
                        },
                        {
                          title: '操作',
                          width: 150,
                          render: (_: any, record: Task) => (
                            <Space>
                              <Button type="link" onClick={() => previewTask(record)}>
                                预览
                              </Button>
                            </Space>
                          ),
                        },
                      ]}
                      dataSource={assignedTasks}
                      rowKey="id"
                      loading={loading}
                      pagination={{ pageSize: 10 }}
                      expandable={{
                        expandedRowRender: (record: Task) => (
                          <div style={{ paddingLeft: 24 }}>
                            <Row gutter={16}>
                              <Col span={4}>
                                <Statistic
                                  title="总数"
                                  value={record.total_items}
                                  valueStyle={{ fontSize: 16 }}
                                />
                              </Col>
                              <Col span={4}>
                                <Statistic
                                  title="已审核"
                                  value={record.reviewed_items}
                                  valueStyle={{ fontSize: 16, color: '#1890ff' }}
                                />
                              </Col>
                              <Col span={4}>
                                <Statistic
                                  title="通过"
                                  value={record.status_counts?.approved || 0}
                                  valueStyle={{ fontSize: 16, color: '#52c41a' }}
                                />
                              </Col>
                              <Col span={4}>
                                <Statistic
                                  title="修改"
                                  value={record.status_counts?.modified || 0}
                                  valueStyle={{ fontSize: 16, color: '#faad14' }}
                                />
                              </Col>
                              <Col span={4}>
                                <Statistic
                                  title="拒绝"
                                  value={record.status_counts?.rejected || 0}
                                  valueStyle={{ fontSize: 16, color: '#ff4d4f' }}
                                />
                              </Col>
                              <Col span={4}>
                                <Statistic
                                  title="待处理"
                                  value={record.status_counts?.pending || 0}
                                  valueStyle={{ fontSize: 16 }}
                                />
                              </Col>
                            </Row>
                          </div>
                        ),
                        rowExpandable: (record: Task) =>
                          record.status === 'in_progress' || record.status === 'pending',
                      }}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
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
