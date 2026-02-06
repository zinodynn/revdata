import { Form, Input, message, Modal } from 'antd'
import { useState } from 'react'
import { foldersApi } from '../services/api'

interface CreateFolderModalProps {
  open: boolean
  parentId: number | null
  parentName?: string
  onClose: () => void
  onSuccess: () => void
}

export default function CreateFolderModal({
  open,
  parentId,
  parentName,
  onClose,
  onSuccess,
}: CreateFolderModalProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await foldersApi.create({
        name: values.name.trim(),
        parent_id: parentId,
      })
      message.success('目录创建成功')
      form.resetFields()
      onSuccess()
      onClose()
    } catch (error: any) {
      if (error.response?.data?.detail) {
        message.error(error.response.data.detail)
      } else if (error.errorFields) {
        // 表单验证错误
      } else {
        message.error('创建目录失败')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title={parentId ? `在 "${parentName}" 下新建目录` : '新建目录'}
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="创建"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="目录名称"
          rules={[
            { required: true, message: '请输入目录名称' },
            { max: 200, message: '目录名称不能超过200个字符' },
            {
              pattern: /^[^/\\:*?"<>|]+$/,
              message: '目录名称不能包含特殊字符 / \\ : * ? " < > |',
            },
          ]}
        >
          <Input placeholder="输入目录名称" autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  )
}
