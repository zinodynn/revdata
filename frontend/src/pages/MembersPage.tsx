import {
  CheckCircleOutlined,
  EditOutlined,
  KeyOutlined,
  ReloadOutlined,
  StopOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { datasetsApi, usersApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
const { Title, Text } = Typography

interface User {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

const roleColors: Record<string, string> = {
  super_admin: 'red',
  admin: 'orange',
  reviewer: 'green',
  viewer: 'blue',
}

const roleLabels: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  reviewer: '审核员',
  viewer: '查看者',
}

export default function MembersPage() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [userToDisable, setUserToDisable] = useState<User | null>(null)
  const [newOwnerId, setNewOwnerId] = useState<number | null>(null)
  const [form] = Form.useForm()

  const roleHierarchy: Record<string, number> = {
    super_admin: 4,
    admin: 3,
    reviewer: 2,
    viewer: 1,
  }

  const canManage = (targetUser: User) => {
    if (currentUser?.role === 'super_admin') return true
    return (roleHierarchy[currentUser?.role || ''] || 0) > (roleHierarchy[targetUser.role] || 0)
  }

  const canEdit = (targetUser: User) => {
    if (currentUser?.id === targetUser.id) return true
    return canManage(targetUser)
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await usersApi.list()
      setUsers(res.data)
    } catch (error) {
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreate = () => {
    setEditingUser(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue({
      username: user.username,
      email: user.email,
      role: user.role,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, values)
        message.success('更新成功')
      } else {
        await usersApi.create(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchUsers()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleToggleStatus = async (user: User) => {
    try {
      if (user.is_active) {
        await usersApi.delete(user.id)
        message.success('已禁用用户')
      } else {
        await usersApi.update(user.id, { is_active: true })
        message.success('已启用用户')
      }
      fetchUsers()
    } catch (error: any) {
      if (error.response?.data?.detail?.includes('拥有数据集')) {
        setUserToDisable(user)
        setTransferModalOpen(true)
      } else {
        message.error(error.response?.data?.detail || '操作失败')
      }
    }
  }

  const handleTransferAndDisable = async () => {
    if (!userToDisable || !newOwnerId) return
    try {
      await datasetsApi.transferAll(userToDisable.id, newOwnerId)
      await usersApi.delete(userToDisable.id)
      message.success('已转移数据集并禁用用户')
      setTransferModalOpen(false)
      setUserToDisable(null)
      setNewOwnerId(null)
      fetchUsers()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleResetPassword = async (id: number) => {
    try {
      const res = await usersApi.resetPassword(id)
      Modal.success({
        title: '密码已重置',
        content: `新密码: ${res.data.new_password}`,
      })
    } catch (error) {
      message.error('重置密码失败')
    }
  }

  const columns = [
    {
      title: '用户',
      key: 'user',
      render: (_: any, record: User) => (
        <Space>
          <Avatar style={{ background: roleColors[record.role] }}>
            {record.username[0].toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.username}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      render: (role: string) => <Tag color={roleColors[role]}>{roleLabels[role]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      render: (active: boolean) =>
        active ? <Tag color="blue">正常</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={!canEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="text"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => handleResetPassword(record.id)}
            disabled={!canEdit(record)}
          >
            重置密码
          </Button>
          <Popconfirm
            title={`确定${record.is_active ? '禁用' : '启用'}该用户吗？`}
            onConfirm={() => handleToggleStatus(record)}
            disabled={!canManage(record) || currentUser?.id === record.id}
          >
            <Button
              type="text"
              size="small"
              danger={record.is_active}
              style={!record.is_active ? { color: '#52c41a' } : {}}
              icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              disabled={!canManage(record) || currentUser?.id === record.id}
            >
              {record.is_active ? '禁用' : '启用'}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            成员管理
          </Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchUsers}>
              刷新
            </Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={handleCreate}>
              添加成员
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingUser ? '编辑成员' : '添加成员'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="输入用户名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱' },
            ]}
          >
            <Input placeholder="输入邮箱" />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="输入密码" />
            </Form.Item>
          )}

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
            initialValue="reviewer"
          >
            <Select>
              <Select.Option value="viewer">查看者</Select.Option>
              <Select.Option value="reviewer">审核员</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
              {currentUser?.role === 'super_admin' && (
                <Select.Option value="super_admin">超级管理员</Select.Option>
              )}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingUser ? '保存' : '创建'}
              </Button>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 转移数据集所有权弹窗 */}
      <Modal
        title="转移数据集所有权"
        open={transferModalOpen}
        onCancel={() => {
          setTransferModalOpen(false)
          setUserToDisable(null)
          setNewOwnerId(null)
        }}
        onOk={handleTransferAndDisable}
        okButtonProps={{ disabled: !newOwnerId }}
        okText="转移并禁用"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Text>
            用户 <b>{userToDisable?.username}</b>{' '}
            拥有数据集，必须先将所有权转移给其他活跃用户才能禁用。
          </Text>
        </div>
        <Form layout="vertical">
          <Form.Item label="选择新所有者" required>
            <Select
              placeholder="请选择接收数据集的用户"
              onChange={(value) => setNewOwnerId(value)}
              value={newOwnerId}
            >
              {users
                .filter(
                  (u) =>
                    u.id !== userToDisable?.id &&
                    u.is_active &&
                    (u.role === 'admin' || u.role === 'super_admin'),
                )
                .map((u) => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.username} ({roleLabels[u.role]})
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
