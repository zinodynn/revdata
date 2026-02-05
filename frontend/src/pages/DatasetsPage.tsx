import {
    DeleteOutlined,
    ExportOutlined,
    EyeOutlined,
    FolderOutlined,
    KeyOutlined,
    MoreOutlined,
    PlusOutlined,
    SendOutlined,
    SettingOutlined,
    UploadOutlined,
} from '@ant-design/icons'
import {
    Button,
    Card,
    Col,
    Dropdown,
    Form,
    Input,
    message,
    Modal,
    Row,
    Space,
    Spin,
    Steps,
    Table,
    Tag,
    Typography,
    Upload,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthCodeModal from '../components/AuthCodeModal'
import CreateFolderModal from '../components/CreateFolderModal'
import DelegateModal from '../components/DelegateModal'
import FieldMappingConfig, { FieldMapping, ReviewConfig } from '../components/FieldMappingConfig'
import FolderTree from '../components/FolderTree'
import MoveFolderModal from '../components/MoveFolderModal'
import { datasetsApi, foldersApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'

const { Title } = Typography

interface Dataset {
  id: number
  name: string
  description: string
  format: string
  item_count: number
  status: string
  created_at: string
}

const statusColors: Record<string, string> = {
  importing: 'processing',
  ready: 'success',
  reviewing: 'warning',
  completed: 'green',
  archived: 'default',
}

const statusLabels: Record<string, string> = {
  importing: '导入中',
  ready: '待审核',
  reviewing: '审核中',
  completed: '已完成',
  archived: '已归档',
}

export default function DatasetsPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [detectedFields, setDetectedFields] = useState<string[]>([])
  const [sampleData, setSampleData] = useState<any[]>([])
  const [suggestedMapping, setSuggestedMapping] = useState<FieldMapping | null>(null)
  const [fieldMapping, setFieldMapping] = useState<FieldMapping | null>(null)
  const [reviewConfig, setReviewConfig] = useState<ReviewConfig | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [authCodeModalOpen, setAuthCodeModalOpen] = useState(false)
  const [delegateModalOpen, setDelegateModalOpen] = useState(false)
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  // 目录相关状态
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [folderRefreshTrigger, setFolderRefreshTrigger] = useState(0)
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false)
  const [createFolderParentId, setCreateFolderParentId] = useState<number | null>(null)
  const [createFolderParentName, setCreateFolderParentName] = useState<string | undefined>(undefined)
  const [moveFolderModalOpen, setMoveFolderModalOpen] = useState(false)
  const [moveDatasetId, setMoveDatasetId] = useState<number | null>(null)
  const [moveDatasetName, setMoveDatasetName] = useState<string>('')
  const [renameFolderModalOpen, setRenameFolderModalOpen] = useState(false)
  const [renameFolderId, setRenameFolderId] = useState<number | null>(null)
  const [renameFolderName, setRenameFolderName] = useState('')
  const [renameForm] = Form.useForm()

  const fetchDatasets = async (folderId?: number | null) => {
    setLoading(true)
    try {
      const res = await datasetsApi.list(1, 100, folderId)
      setDatasets(res.data.items)
    } catch (error) {
      message.error('获取数据集失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDatasets(selectedFolderId)
  }, [selectedFolderId])

  const handleUpload = async (values: any) => {
    if (!selectedFile) {
      message.error('请选择文件')
      return
    }

    setUploading(true)
    try {
      const res = await datasetsApi.upload(selectedFile, values.name, values.description)
      const datasetId = res.data.id

      // 如果有字段映射配置，更新数据集
      if (fieldMapping) {
        await datasetsApi.update(datasetId, {
          field_mapping: fieldMapping,
          review_config: reviewConfig || undefined,
        })
      }

      message.success('上传成功')
      handleCloseModal()
      fetchDatasets(selectedFolderId)
      setFolderRefreshTrigger((prev) => prev + 1)
    } catch (error: any) {
      message.error(error.response?.data?.detail || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)
    setDetecting(true)
    try {
      const res = await datasetsApi.detectFields(file)
      setDetectedFields(res.data.detected_fields)
      setSampleData(res.data.sample_data)
      setSuggestedMapping(res.data.suggested_mapping)
      setFieldMapping(res.data.suggested_mapping)
      setCurrentStep(1)
    } catch (error: any) {
      message.error(error.response?.data?.detail || '文件解析失败')
    } finally {
      setDetecting(false)
    }
    return false
  }

  const handleCloseModal = () => {
    setUploadModalOpen(false)
    setCurrentStep(0)
    setSelectedFile(null)
    setDetectedFields([])
    setSampleData([])
    setSuggestedMapping(null)
    setFieldMapping(null)
    setReviewConfig(null)
    form.resetFields()
  }

  const handleDelete = async (id: number) => {
    try {
      await datasetsApi.delete(id)
      message.success('数据集已删除')
      fetchDatasets(selectedFolderId)
      setFolderRefreshTrigger((prev) => prev + 1)
    } catch (error: any) {
      message.error(error.response?.data?.detail || '删除失败')
    }
  }

  // 目录操作
  const handleCreateFolder = (parentId: number | null, parentName?: string) => {
    setCreateFolderParentId(parentId)
    setCreateFolderParentName(parentName)
    setCreateFolderModalOpen(true)
  }

  const handleRenameFolder = (folder: { id: number; name: string }) => {
    setRenameFolderId(folder.id)
    setRenameFolderName(folder.name)
    renameForm.setFieldsValue({ name: folder.name })
    setRenameFolderModalOpen(true)
  }

  const handleDeleteFolder = async (folderId: number) => {
    Modal.confirm({
      title: '确定要删除此目录吗？',
      content: '目录必须为空才能删除。',
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await foldersApi.delete(folderId)
          message.success('目录已删除')
          setFolderRefreshTrigger((prev) => prev + 1)
          if (selectedFolderId === folderId) {
            setSelectedFolderId(null)
          }
        } catch (error: any) {
          message.error(error.response?.data?.detail || '删除目录失败')
        }
      },
    })
  }

  const handleRenameFolderSubmit = async () => {
    try {
      const values = await renameForm.validateFields()
      if (renameFolderId) {
        await foldersApi.update(renameFolderId, { name: values.name.trim() })
        message.success('目录已重命名')
        setRenameFolderModalOpen(false)
        setFolderRefreshTrigger((prev) => prev + 1)
      }
    } catch (error: any) {
      if (error.response?.data?.detail) {
        message.error(error.response.data.detail)
      }
    }
  }

  const handleMoveDataset = (dataset: Dataset) => {
    setMoveDatasetId(dataset.id)
    setMoveDatasetName(dataset.name)
    setMoveFolderModalOpen(true)
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
    },
    {
      title: '格式',
      dataIndex: 'format',
      width: 100,
      render: (format: string) => <Tag>{format.toUpperCase()}</Tag>,
    },
    {
      title: '条目数',
      dataIndex: 'item_count',
      width: 100,
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
      width: 220,
      render: (_: any, record: Dataset) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/datasets/${record.id}/review`)}
          >
            预览
          </Button>
          {isAdmin && (
            <>
              <Button
                type="link"
                size="small"
                icon={<SendOutlined />}
                onClick={() => {
                  setSelectedDatasetId(record.id)
                  setDelegateModalOpen(true)
                }}
              >
                委派
              </Button>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'auth_code',
                      icon: <KeyOutlined />,
                      label: '生成授权码',
                      onClick: () => {
                        setSelectedDatasetId(record.id)
                        setAuthCodeModalOpen(true)
                      },
                    },
                    {
                      key: 'detail',
                      icon: <SettingOutlined />,
                      label: '配置',
                      onClick: () => navigate(`/datasets/${record.id}`),
                    },
                    {
                      key: 'export',
                      icon: <ExportOutlined />,
                      label: '导出',
                      onClick: () => navigate(`/datasets/${record.id}`),
                    },
                    {
                      key: 'move',
                      icon: <FolderOutlined />,
                      label: '移动到目录',
                      onClick: () => handleMoveDataset(record),
                    },
                    {
                      type: 'divider',
                    },
                    {
                      key: 'delete',
                      icon: <DeleteOutlined />,
                      label: '删除',
                      danger: true,
                      onClick: () => {
                        Modal.confirm({
                          title: '确定要删除该数据集吗？',
                          content: '删除后将无法恢复，且会同时删除所有相关的任务和授权码。',
                          okText: '确定',
                          okType: 'danger',
                          cancelText: '取消',
                          onOk: () => handleDelete(record.id),
                        })
                      },
                    },
                  ],
                }}
              >
                <Button type="text" icon={<MoreOutlined />} />
              </Dropdown>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          数据集列表
        </Title>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadModalOpen(true)}>
            上传数据集
          </Button>
        )}
      </div>

      <Row gutter={16}>
        {/* 左侧目录树 */}
        <Col span={5}>
          <Card size="small" style={{ minHeight: 400 }}>
            <FolderTree
              selectedFolderId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onCreateFolder={(parentId) => handleCreateFolder(parentId)}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              refreshTrigger={folderRefreshTrigger}
            />
          </Card>
        </Col>

        {/* 右侧数据集列表 */}
        <Col span={19}>
          <Card>
            <Table
              columns={columns}
              dataSource={datasets}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      <AuthCodeModal
        open={authCodeModalOpen}
        onClose={() => setAuthCodeModalOpen(false)}
        datasetId={selectedDatasetId || 0}
      />

      <DelegateModal
        open={delegateModalOpen}
        onClose={() => setDelegateModalOpen(false)}
        datasetId={selectedDatasetId || 0}
        currentItemSeq={1}
        totalItems={datasets.find((d) => d.id === selectedDatasetId)?.item_count || 0}
      />

      <Modal
        title="上传数据集"
        open={uploadModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Steps
          current={currentStep}
          style={{ marginBottom: 24 }}
          items={[{ title: '选择文件' }, { title: '配置字段映射' }, { title: '确认上传' }]}
        />

        {currentStep === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            {detecting ? (
              <Spin tip="正在解析文件..." />
            ) : (
              <Upload.Dragger
                beforeUpload={handleFileSelect}
                showUploadList={false}
                accept=".jsonl,.json,.csv,.tsv,.zip"
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此处</p>
                <p className="ant-upload-hint">支持 JSONL、JSON、CSV、TSV、ZIP 格式</p>
              </Upload.Dragger>
            )}
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Tag color="blue">{selectedFile?.name}</Tag>
              <Button type="link" onClick={() => setCurrentStep(0)}>
                重新选择
              </Button>
            </div>
            <FieldMappingConfig
              detectedFields={detectedFields}
              sampleData={sampleData}
              initialMapping={suggestedMapping || undefined}
              onChange={(mapping, config) => {
                setFieldMapping(mapping)
                setReviewConfig(config)
              }}
              showPreview
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setCurrentStep(0)}>上一步</Button>
                <Button type="primary" onClick={() => setCurrentStep(2)}>
                  下一步
                </Button>
              </Space>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <Form form={form} layout="vertical" onFinish={handleUpload}>
            <Form.Item
              name="name"
              label="数据集名称"
              rules={[{ required: true }]}
              initialValue={selectedFile?.name.replace(/\.[^/.]+$/, '')}
            >
              <Input placeholder="请输入数据集名称" />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea placeholder="可选描述" rows={3} />
            </Form.Item>
            <Card size="small" title="字段映射预览" style={{ marginBottom: 16 }}>
              <Space wrap>
                {fieldMapping?.question_field && (
                  <Tag color="blue">问题: {fieldMapping.question_field}</Tag>
                )}
                {fieldMapping?.answer_field && (
                  <Tag color="green">回答: {fieldMapping.answer_field}</Tag>
                )}
                {fieldMapping?.thinking_field && (
                  <Tag color="gold">思考: {fieldMapping.thinking_field}</Tag>
                )}
                {fieldMapping?.display_mode && <Tag>模式: {fieldMapping.display_mode}</Tag>}
              </Space>
            </Card>
            <Form.Item>
              <Space>
                <Button onClick={() => setCurrentStep(1)}>上一步</Button>
                <Button type="primary" htmlType="submit" loading={uploading}>
                  确认上传
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 新建目录弹窗 */}
      <CreateFolderModal
        open={createFolderModalOpen}
        parentId={createFolderParentId}
        parentName={createFolderParentName}
        onClose={() => setCreateFolderModalOpen(false)}
        onSuccess={() => setFolderRefreshTrigger((prev) => prev + 1)}
      />

      {/* 移动数据集弹窗 */}
      <MoveFolderModal
        open={moveFolderModalOpen}
        datasetId={moveDatasetId}
        datasetName={moveDatasetName}
        onClose={() => setMoveFolderModalOpen(false)}
        onSuccess={() => {
          fetchDatasets(selectedFolderId)
          setFolderRefreshTrigger((prev) => prev + 1)
        }}
      />

      {/* 重命名目录弹窗 */}
      <Modal
        title="重命名目录"
        open={renameFolderModalOpen}
        onOk={handleRenameFolderSubmit}
        onCancel={() => setRenameFolderModalOpen(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={renameForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="目录名称"
            rules={[
              { required: true, message: '请输入目录名称' },
              { max: 200, message: '目录名称不能超过200个字符' },
            ]}
          >
            <Input placeholder="输入新的目录名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
