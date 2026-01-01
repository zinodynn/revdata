import { SendOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, InputNumber, message, Modal, Select } from 'antd'
import { useEffect, useState } from 'react'
import { tasksApi } from '../services/api'

interface DelegateModalProps {
  open: boolean
  onClose: () => void
  datasetId: number
  currentItemSeq: number
  totalItems: number
  itemIds?: number[]
}

interface User {
  id: number
  username: string
  email: string
  role: string
}

export default function DelegateModal({
  open,
  onClose,
  datasetId,
  currentItemSeq,
  totalItems,
  itemIds,
}: DelegateModalProps) {
  const [form] = Form.useForm()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [delegating, setDelegating] = useState(false)

  useEffect(() => {
    if (open) {
      fetchUsers()
      if (itemIds && itemIds.length > 0) {
        form.setFieldsValue({
          item_start: 0,
          item_end: 0,
        })
      } else {
        form.setFieldsValue({
          item_start: currentItemSeq,
          item_end: totalItems,
        })
      }
    }
  }, [open, currentItemSeq, totalItems, itemIds])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await tasksApi.getUsers()
      setUsers(res.data)
    } catch (error) {
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelegate = async (values: any) => {
    setDelegating(true)
    try {
      await tasksApi.create({
        dataset_id: datasetId,
        assignee_id: values.assignee_id,
        item_start: values.item_start,
        item_end: values.item_end,
        item_ids: itemIds,
        priority: values.priority || 0,
        note: values.note,
      })
      message.success('任务已创建并分配')
      onClose()
      form.resetFields()
    } catch (error) {
      message.error('分配失败')
    } finally {
      setDelegating(false)
    }
  }

  return (
    <Modal
      title={
        <>
          <SendOutlined /> 委派任务
        </>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Alert
        message="委派说明"
        description="选择审核范围和分配人员，创建新的审核任务。被分配人将在我的任务中看到此任务。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical" onFinish={handleDelegate}>
        <Form.Item
          name="assignee_id"
          label="分配给"
          rules={[{ required: true, message: '请选择分配人员' }]}
        >
          <Select
            placeholder="选择审核人员"
            loading={loading}
            showSearch
            optionFilterProp="children"
          >
            {users.map((u) => (
              <Select.Option key={u.id} value={u.id}>
                {u.username} ({u.email}) - {u.role}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            name="item_start"
            label="起始序号"
            rules={[{ required: true }]}
            style={{ flex: 1 }}
          >
            <InputNumber min={1} max={totalItems} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="item_end"
            label="结束序号"
            rules={[{ required: true }]}
            style={{ flex: 1 }}
          >
            <InputNumber min={1} max={totalItems} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <Form.Item name="priority" label="优先级" initialValue={0}>
          <Select>
            <Select.Option value={0}>普通</Select.Option>
            <Select.Option value={1}>高</Select.Option>
            <Select.Option value={2}>紧急</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="note" label="备注">
          <Input.TextArea rows={3} placeholder="可选：添加任务说明或备注" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={delegating} icon={<SendOutlined />}>
            创建任务
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
