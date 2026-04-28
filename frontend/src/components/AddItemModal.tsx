import { BulbOutlined } from '@ant-design/icons'
import { Button, Form, Input, message, Modal, Radio, Space, Tag, Tooltip } from 'antd'
import { useState } from 'react'
import { itemsApi } from '../services/api'

interface AddItemModalProps {
  open: boolean
  onClose: () => void
  datasetId: number
  onSuccess?: () => void
}

export default function AddItemModal({ open, onClose, datasetId, onSuccess }: AddItemModalProps) {
  const [form] = Form.useForm()
  const [itemType, setItemType] = useState<'qa' | 'plain'>('qa')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      const content =
        itemType === 'qa'
          ? {
              messages: [
                { role: 'user', content: values.question },
                ...(values.answer ? [{ role: 'assistant', content: values.answer }] : []),
              ],
            }
          : { text: values.text }

      await itemsApi.create({
        dataset_id: datasetId,
        item_type: itemType,
        content,
      })

      message.success('语料添加成功，已进入待审核列表')
      onSuccess?.()
      handleClose()
    } catch (error) {
      console.error('Failed to add item:', error)
      message.error('添加失败，请检查网络或联系管理员')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    form.resetFields()
    setItemType('qa')
    onClose()
  }

  return (
    <Modal
      title={
        <Space>
          <BulbOutlined />
          新增问题
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={[
        <Button key="back" onClick={handleClose}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSave}>
          保存并关闭
        </Button>,
      ]}
      width={600}
    >
      <Form form={form} layout="vertical" name="addItemForm">
        <Form.Item label="类型">
          <Radio.Group value={itemType} onChange={(e) => setItemType(e.target.value)}>
            <Radio value="qa">QA对话</Radio>
            <Radio value="plain">纯文本</Radio>
          </Radio.Group>
        </Form.Item>

        {itemType === 'qa' ? (
          <>
            <Form.Item
              name="question"
              label="问题 (Q)"
              rules={[{ required: true, message: '请输入问题内容' }]}
            >
              <Input.TextArea rows={4} placeholder="请输入用户的问题" />
            </Form.Item>
            <Form.Item
              name="answer"
              label={
                <Tooltip title="回答是可选的。如果留空，后续可以由AI或其他审核人员补充。">
                  <span>回答 (A) - 可选</span>
                </Tooltip>
              }
            >
              <Input.TextArea rows={6} placeholder="请输入对应的回答（可选）" />
            </Form.Item>
          </>
        ) : (
          <Form.Item
            name="text"
            label="文本内容"
            rules={[{ required: true, message: '请输入文本内容' }]}
          >
            <Input.TextArea rows={8} placeholder="请输入纯文本语料" />
          </Form.Item>
        )}
        <Tag color="purple">用户添加</Tag>
        <span style={{ marginLeft: 8, color: '#888' }}>
          此语料将被标记为"用户添加"来源，并进入待审核流程。
        </span>
      </Form>
    </Modal>
  )
}
