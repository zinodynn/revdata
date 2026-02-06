import {
  ArrowLeftOutlined,
  BookOutlined,
  DatabaseOutlined,
  EditOutlined,
  ExportOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  ConfigProvider,
  Descriptions,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Radio,
  Row,
  Select,
  Slider,
  Space,
  Spin,
  Statistic,
  Switch,
  Tabs,
  Tag,
  theme,
  Typography,
  Upload,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FieldMappingConfig, { FieldMapping, ReviewConfig } from '../components/FieldMappingConfig'
import ReferenceDocsPanel from '../components/ReferenceDocsPanel'
import { datasetsApi, exportApi, usersApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'

const { Title } = Typography

interface Dataset {
  id: number
  name: string
  description: string
  format: string
  source_file: string
  item_count: number
  owner_id: number
  status: string
  field_mapping: any
  review_config: any
  created_at: string
  updated_at: string
}

interface PreviewData {
  dataset_id: number
  dataset_name: string
  total_items: number
  detected_fields: string[]
  current_mapping: any
  sample_data: any[]
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

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const appTheme = useSettingsStore((state) => state.theme)
  const isDark = appTheme === 'dark'
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [_saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [newOwnerId, setNewOwnerId] = useState<number | null>(null)

  // 追加导入状态
  const [appendModalOpen, setAppendModalOpen] = useState(false)
  const [appendFile, setAppendFile] = useState<File | null>(null)
  const [appendSkipDuplicates, setAppendSkipDuplicates] = useState(false)
  const [appending, setAppending] = useState(false)

  // 去重配置状态
  const [dedupConfig, setDedupConfig] = useState<any>(null)
  const [savingDedup, setSavingDedup] = useState(false)

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    if (id) {
      fetchDataset()
      fetchPreview()
      if (isAdmin) fetchUsers()
    }
  }, [id])

  const fetchUsers = async () => {
    try {
      const res = await usersApi.list()
      setUsers(res.data)
    } catch (error) {
      console.error('获取用户列表失败', error)
    }
  }

  const fetchDataset = async () => {
    try {
      const res = await datasetsApi.get(Number(id))
      setDataset(res.data)
      // 初始化去重配置
      if (res.data.dedup_config) {
        setDedupConfig(res.data.dedup_config)
      } else {
        setDedupConfig({
          enabled: false,
          use_embedding: false,
          embedding_api_url: '',
          embedding_api_key: '',
          embedding_model: 'text-embedding-ada-002',
          embedding_batch_size: 32,
          embedding_concurrency: 1,
          similarity_threshold: 0.8,
          query_field: 'question',
        })
      }
    } catch (error) {
      message.error('获取数据集失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchPreview = async () => {
    try {
      const res = await datasetsApi.preview(Number(id), 5)
      setPreviewData(res.data)
    } catch (error) {
      console.error('获取预览数据失败', error)
    }
  }

  const handleSaveConfig = async (mapping: FieldMapping, reviewConfig: ReviewConfig) => {
    if (!dataset) return
    setSaving(true)
    try {
      await datasetsApi.update(dataset.id, {
        field_mapping: mapping,
        review_config: reviewConfig,
      })
      message.success('配置保存成功')
      fetchDataset()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 追加导入
  const handleAppend = async () => {
    if (!dataset || !appendFile) return
    setAppending(true)
    try {
      await datasetsApi.append(dataset.id, appendFile, appendSkipDuplicates)
      message.success('追加导入任务已提交，正在后台处理')
      setAppendModalOpen(false)
      setAppendFile(null)
      setAppendSkipDuplicates(false)
      // 延迟刷新，等待后台处理
      setTimeout(() => fetchDataset(), 2000)
    } catch (error: any) {
      message.error(error.response?.data?.detail || '追加导入失败')
    } finally {
      setAppending(false)
    }
  }

  // 保存去重配置
  const handleSaveDedupConfig = async () => {
    if (!dataset || !dedupConfig) return
    setSavingDedup(true)
    try {
      await datasetsApi.update(dataset.id, {
        dedup_config: dedupConfig,
      } as any)
      message.success('去重配置保存成功')
      fetchDataset()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '保存失败')
    } finally {
      setSavingDedup(false)
    }
  }

  const handleExport = async (format: string) => {
    if (!dataset) return
    setExporting(true)
    try {
      const res = await exportApi.download(dataset.id, {
        format,
        include_original: true,
      })
      const blob = new Blob([res.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${dataset.name}_export.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const handleTransfer = async () => {
    if (!dataset || !newOwnerId) return
    try {
      await datasetsApi.update(dataset.id, { owner_id: newOwnerId })
      message.success('所有权转移成功')
      setTransferModalOpen(false)
      setNewOwnerId(null)
      fetchDataset()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '转移失败')
    }
  }

  const getOwnerName = (ownerId: number) => {
    const owner = users.find((u) => u.id === ownerId)
    return owner ? owner.username : `ID: ${ownerId}`
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!dataset) {
    return (
      <Alert
        message="数据集不存在"
        type="error"
        showIcon
        action={<Button onClick={() => navigate('/datasets')}>返回列表</Button>}
      />
    )
  }

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <DatabaseOutlined />
          概览
        </span>
      ),
      children: (
        <div>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title="总条目数" value={dataset.item_count} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="文件格式" value={dataset.format.toUpperCase()} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="状态"
                  valueRender={() => (
                    <Tag color={statusColors[dataset.status]}>
                      {statusLabels[dataset.status] || dataset.status}
                    </Tag>
                  )}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="创建时间"
                  value={new Date(dataset.created_at).toLocaleDateString()}
                />
              </Card>
            </Col>
          </Row>

          <Card title="数据集信息">
            <Descriptions column={2}>
              <Descriptions.Item label="名称">{dataset.name}</Descriptions.Item>
              <Descriptions.Item label="ID">{dataset.id}</Descriptions.Item>
              <Descriptions.Item label="所有者">
                <Space>
                  {getOwnerName(dataset.owner_id)}
                  {isAdmin && (
                    <Button type="link" size="small" onClick={() => setTransferModalOpen(true)}>
                      转移
                    </Button>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="源文件">{dataset.source_file}</Descriptions.Item>
              <Descriptions.Item label="格式">{dataset.format}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {dataset.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(dataset.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(dataset.updated_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 当前字段映射摘要 */}
          {dataset.field_mapping && (
            <Card title="当前字段映射" style={{ marginTop: 16 }}>
              <Space wrap>
                {dataset.field_mapping.question_field && (
                  <Tag color="blue">问题: {dataset.field_mapping.question_field}</Tag>
                )}
                {dataset.field_mapping.answer_field && (
                  <Tag color="green">回答: {dataset.field_mapping.answer_field}</Tag>
                )}
                {dataset.field_mapping.thinking_field && (
                  <Tag color="gold">思考: {dataset.field_mapping.thinking_field}</Tag>
                )}
                {dataset.field_mapping.context_field && (
                  <Tag color="purple">上下文: {dataset.field_mapping.context_field}</Tag>
                )}
                {dataset.field_mapping.messages_field && (
                  <Tag color="cyan">消息: {dataset.field_mapping.messages_field}</Tag>
                )}
                <Tag>模式: {dataset.field_mapping.display_mode}</Tag>
              </Space>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'config',
      label: (
        <span>
          <SettingOutlined />
          字段映射配置
        </span>
      ),
      children: previewData ? (
        <FieldMappingConfig
          detectedFields={previewData.detected_fields}
          sampleData={previewData.sample_data}
          initialMapping={dataset.field_mapping}
          initialReviewConfig={dataset.review_config}
          onSave={handleSaveConfig}
          readOnly={!isAdmin}
        />
      ) : (
        <Spin />
      ),
    },
    {
      key: 'dedup',
      label: (
        <span>
          <SafetyCertificateOutlined />
          去重设置
        </span>
      ),
      children: dedupConfig ? (
        <Card>
          <Form layout="vertical">
            <Form.Item label="启用去重">
              <Switch
                checked={dedupConfig.enabled}
                onChange={(v) => setDedupConfig({ ...dedupConfig, enabled: v })}
                disabled={!isAdmin}
              />
            </Form.Item>

            {dedupConfig.enabled && (
              <>
                <Form.Item label="去重模式">
                  <Radio.Group
                    value={dedupConfig.use_embedding ? 'embedding' : 'text'}
                    onChange={(e) =>
                      setDedupConfig({
                        ...dedupConfig,
                        use_embedding: e.target.value === 'embedding',
                      })
                    }
                    disabled={!isAdmin}
                  >
                    <Radio value="text">文本相似度 (Jaccard)</Radio>
                    <Radio value="embedding">Embedding 向量 (需配置 API)</Radio>
                  </Radio.Group>
                </Form.Item>

                {dedupConfig.use_embedding && (
                  <>
                    <Form.Item label="Embedding API URL" required>
                      <Input
                        value={dedupConfig.embedding_api_url}
                        onChange={(e) =>
                          setDedupConfig({
                            ...dedupConfig,
                            embedding_api_url: e.target.value,
                          })
                        }
                        placeholder="https://api.openai.com/v1/embeddings"
                        disabled={!isAdmin}
                      />
                    </Form.Item>
                    <Form.Item label="API Key">
                      <Input.Password
                        value={dedupConfig.embedding_api_key}
                        onChange={(e) =>
                          setDedupConfig({
                            ...dedupConfig,
                            embedding_api_key: e.target.value,
                          })
                        }
                        placeholder="sk-..."
                        disabled={!isAdmin}
                      />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item label="模型名称">
                          <Input
                            value={dedupConfig.embedding_model}
                            onChange={(e) =>
                              setDedupConfig({
                                ...dedupConfig,
                                embedding_model: e.target.value,
                              })
                            }
                            disabled={!isAdmin}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="批量大小">
                          <InputNumber
                            value={dedupConfig.embedding_batch_size}
                            min={1}
                            max={100}
                            onChange={(v) =>
                              setDedupConfig({
                                ...dedupConfig,
                                embedding_batch_size: v,
                              })
                            }
                            style={{ width: '100%' }}
                            disabled={!isAdmin}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="并发数">
                          <InputNumber
                            value={dedupConfig.embedding_concurrency}
                            min={1}
                            max={10}
                            onChange={(v) =>
                              setDedupConfig({
                                ...dedupConfig,
                                embedding_concurrency: v,
                              })
                            }
                            style={{ width: '100%' }}
                            disabled={!isAdmin}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                )}

                <Form.Item label={`相似度阈值: ${dedupConfig.similarity_threshold}`}>
                  <Slider
                    value={dedupConfig.similarity_threshold}
                    min={0.5}
                    max={1.0}
                    step={0.05}
                    onChange={(v) =>
                      setDedupConfig({ ...dedupConfig, similarity_threshold: v })
                    }
                    marks={{ 0.5: '0.5', 0.8: '0.8', 1.0: '1.0' }}
                    disabled={!isAdmin}
                  />
                </Form.Item>

                <Form.Item label="比较字段">
                  <Select
                    value={dedupConfig.query_field}
                    onChange={(v) =>
                      setDedupConfig({ ...dedupConfig, query_field: v })
                    }
                    disabled={!isAdmin}
                    style={{ width: 200 }}
                  >
                    {(previewData?.detected_fields || []).map((f) => (
                      <Select.Option key={f} value={f}>
                        {f}
                      </Select.Option>
                    ))}
                    <Select.Option value="question">question (默认)</Select.Option>
                  </Select>
                </Form.Item>
              </>
            )}

            {isAdmin && (
              <Form.Item>
                <Button
                  type="primary"
                  onClick={handleSaveDedupConfig}
                  loading={savingDedup}
                >
                  保存去重配置
                </Button>
              </Form.Item>
            )}
          </Form>
        </Card>
      ) : (
        <Spin />
      ),
    },
    {
      key: 'docs',
      label: (
        <span>
          <BookOutlined />
          参考文档
        </span>
      ),
      children: (
        <ReferenceDocsPanel datasetId={dataset.id} readOnly={!isAdmin} />
      ),
    },
  ]

  // 深色/浅色主题配置
  const darkTheme = {
    algorithm: theme.darkAlgorithm,
    token: {
      colorPrimary: '#1890ff',
      colorBgContainer: '#1f1f1f',
      colorBgLayout: '#141414',
      colorText: '#e8e8e8',
      colorBorder: '#434343',
    },
  }

  const lightTheme = {
    algorithm: theme.defaultAlgorithm,
    token: {
      colorPrimary: '#1890ff',
    },
  }

  return (
    <ConfigProvider theme={isDark ? darkTheme : lightTheme}>
      <div>
        <Breadcrumb
          items={[
            { title: <a onClick={() => navigate('/datasets')}>数据集</a> },
            { title: dataset.name },
          ]}
          style={{ marginBottom: 16 }}
        />

      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/datasets')} />
            <Title level={4} style={{ margin: 0 }}>
              {dataset.name}
            </Title>
            <Tag color={statusColors[dataset.status]}>
              {statusLabels[dataset.status] || dataset.status}
            </Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<PlayCircleOutlined />}
              type="primary"
              onClick={() => navigate(`/datasets/${dataset.id}/review`)}
            >
              开始审核
            </Button>
            <Button
              icon={<ExportOutlined />}
              loading={exporting}
              onClick={() => handleExport('jsonl')}
            >
              导出 JSONL
            </Button>
            {isAdmin && (
              <Button icon={<EditOutlined />} onClick={() => setActiveTab('config')}>
                配置映射
              </Button>
            )}
            {isAdmin && (
              <Button icon={<PlusOutlined />} onClick={() => setAppendModalOpen(true)}>
                追加数据
              </Button>
            )}
          </Space>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      <Modal
        title="转移数据集所有权"
        open={transferModalOpen}
        onCancel={() => {
          setTransferModalOpen(false)
          setNewOwnerId(null)
        }}
        onOk={handleTransfer}
        okButtonProps={{ disabled: !newOwnerId }}
        okText="确定转移"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text>请选择新的数据集所有者：</Typography.Text>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="选择用户"
          onChange={(value) => setNewOwnerId(value)}
          value={newOwnerId}
        >
          {users
            .filter(
              (u) =>
                u.id !== dataset?.owner_id &&
                u.is_active &&
                (u.role === 'admin' || u.role === 'super_admin'),
            )
            .map((u) => (
              <Select.Option key={u.id} value={u.id}>
                {u.username} ({u.role})
              </Select.Option>
            ))}
        </Select>
      </Modal>

      {/* 追加导入模态框 */}
      <Modal
        title="追加导入数据"
        open={appendModalOpen}
        onCancel={() => {
          setAppendModalOpen(false)
          setAppendFile(null)
          setAppendSkipDuplicates(false)
        }}
        onOk={handleAppend}
        okText="开始导入"
        cancelText="取消"
        okButtonProps={{ disabled: !appendFile, loading: appending }}
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text>
            当前数据集已有 <strong>{dataset?.item_count}</strong> 条数据，追加的数据将按序号接续。
          </Typography.Text>
        </div>
        <Upload.Dragger
          beforeUpload={(file) => {
            setAppendFile(file)
            return false
          }}
          showUploadList={!!appendFile}
          fileList={
            appendFile
              ? [{ uid: '-1', name: appendFile.name, status: 'done' as const }]
              : []
          }
          onRemove={() => setAppendFile(null)}
          accept=".jsonl,.json,.csv,.tsv"
          maxCount={1}
        >
          <p className="ant-upload-text">点击或拖拽文件到此处</p>
          <p className="ant-upload-hint">支持 JSONL、JSON、CSV、TSV 格式</p>
        </Upload.Dragger>
        <div style={{ marginTop: 16 }}>
          <Space>
            <Switch
              checked={appendSkipDuplicates}
              onChange={setAppendSkipDuplicates}
            />
            <Typography.Text>跳过重复项（基于去重设置）</Typography.Text>
          </Space>
          {appendSkipDuplicates && !dedupConfig?.enabled && (
            <div style={{ marginTop: 8 }}>
              <Typography.Text type="warning" style={{ fontSize: 12 }}>
                ⚠ 未配置去重规则，将使用默认文本相似度(阈值0.8)进行去重
              </Typography.Text>
            </div>
          )}
        </div>
      </Modal>
      </div>
    </ConfigProvider>
  )
}
