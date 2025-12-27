import { DownloadOutlined } from '@ant-design/icons'
import { Button, Checkbox, Form, message, Modal, Select } from 'antd'
import { useState } from 'react'
import { exportApi } from '../services/api'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  datasetId: number
  datasetName: string
}

export default function ExportModal({ open, onClose, datasetId, datasetName }: ExportModalProps) {
  const [form] = Form.useForm()
  const [exporting, setExporting] = useState(false)

  const handleExport = async (values: any) => {
    setExporting(true)
    try {
      const response = await exportApi.download(datasetId, {
        format: values.format,
        status_filter: values.status_filter,
        include_original: values.include_original,
      })

      // 创建下载链接
      const blob = new Blob([response.data], { type: response.headers['content-type'] })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${datasetName}_export.${values.format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      message.success('导出成功')
      onClose()
    } catch (error) {
      message.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal
      title={<><DownloadOutlined /> 导出数据集</>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleExport}
        initialValues={{
          format: 'jsonl',
          include_original: false,
        }}
      >
        <Form.Item name="format" label="导出格式" rules={[{ required: true }]}>
          <Select>
            <Select.Option value="jsonl">JSONL (推荐)</Select.Option>
            <Select.Option value="json">JSON</Select.Option>
            <Select.Option value="csv">CSV</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="status_filter" label="筛选状态">
          <Select allowClear placeholder="导出全部">
            <Select.Option value="pending">待审核</Select.Option>
            <Select.Option value="approved">已通过</Select.Option>
            <Select.Option value="rejected">已拒绝</Select.Option>
            <Select.Option value="modified">已修改</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="include_original" valuePropName="checked">
          <Checkbox>包含原始内容 (用于对比修改)</Checkbox>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={exporting} icon={<DownloadOutlined />}>
            导出
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
