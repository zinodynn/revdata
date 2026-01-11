import {
  BulbOutlined,
  EyeOutlined,
  FileTextOutlined,
  MessageOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'

const { Text } = Typography
const { Option } = Select

export interface FieldMapping {
  question_field: string | null
  answer_field: string | null
  thinking_field: string | null
  context_field: string | null
  messages_field: string | null
  metadata_fields: string[]
  display_mode: 'conversation' | 'qa_pair' | 'plain' | 'auto'
  detected_fields: string[]

  // New multi-turn config
  message_role_field?: string
  message_content_field?: string
  user_role_value?: string
  assistant_role_value?: string
  system_role_value?: string

  image_field?: string | null
}

export interface ReviewConfig {
  require_reason: boolean
  allow_edit: boolean
  review_mode: 'single' | 'double'
  auto_approve_after: number | null
}

interface FieldMappingConfigProps {
  detectedFields: string[]
  sampleData?: Record<string, any>[]
  initialMapping?: Partial<FieldMapping>
  initialReviewConfig?: Partial<ReviewConfig>
  onChange?: (mapping: FieldMapping, reviewConfig: ReviewConfig) => void
  onSave?: (mapping: FieldMapping, reviewConfig: ReviewConfig) => void
  showPreview?: boolean
  readOnly?: boolean
}

const defaultMapping: FieldMapping = {
  question_field: null,
  answer_field: null,
  thinking_field: null,
  context_field: null,
  messages_field: null,
  metadata_fields: [],
  display_mode: 'auto',
  detected_fields: [],
  message_role_field: 'role',
  message_content_field: 'content',
  user_role_value: 'user',
  assistant_role_value: 'assistant',
  system_role_value: 'system',
}

const defaultReviewConfig: ReviewConfig = {
  require_reason: false,
  allow_edit: true,
  review_mode: 'single',
  auto_approve_after: null,
}

export default function FieldMappingConfig({
  detectedFields,
  sampleData = [],
  initialMapping,
  initialReviewConfig,
  onChange,
  onSave,
  showPreview = true,
  readOnly = false,
}: FieldMappingConfigProps) {
  const [mapping, setMapping] = useState<FieldMapping>({
    ...defaultMapping,
    ...initialMapping,
    detected_fields: detectedFields,
  })
  const [reviewConfig, setReviewConfig] = useState<ReviewConfig>({
    ...defaultReviewConfig,
    ...initialReviewConfig,
  })
  const [showSamplePreview, setShowSamplePreview] = useState(false)

  useEffect(() => {
    if (onChange) {
      onChange(mapping, reviewConfig)
    }
  }, [mapping, reviewConfig])

  const updateMapping = (key: keyof FieldMapping, value: any) => {
    setMapping((prev) => ({ ...prev, [key]: value }))
  }

  const updateReviewConfig = (key: keyof ReviewConfig, value: any) => {
    setReviewConfig((prev) => ({ ...prev, [key]: value }))
  }

  // 获取未被使用的字段
  const getAvailableFields = (excludeKey?: keyof FieldMapping) => {
    const usedFields = new Set<string>()
    if (mapping.question_field && excludeKey !== 'question_field')
      usedFields.add(mapping.question_field)
    if (mapping.answer_field && excludeKey !== 'answer_field') usedFields.add(mapping.answer_field)
    if (mapping.thinking_field && excludeKey !== 'thinking_field')
      usedFields.add(mapping.thinking_field)
    if (mapping.context_field && excludeKey !== 'context_field')
      usedFields.add(mapping.context_field)
    if (mapping.messages_field && excludeKey !== 'messages_field')
      usedFields.add(mapping.messages_field)
    if (mapping.image_field && excludeKey !== 'image_field') usedFields.add(mapping.image_field)
    return detectedFields.filter((f) => !usedFields.has(f))
  }

  // 预览当前映射效果
  const renderPreview = () => {
    if (!sampleData.length) return null

    const sample = sampleData[0]
    const question = mapping.question_field ? sample[mapping.question_field] : null
    const answer = mapping.answer_field ? sample[mapping.answer_field] : null
    const thinking = mapping.thinking_field ? sample[mapping.thinking_field] : null
    const context = mapping.context_field ? sample[mapping.context_field] : null
    const messages = mapping.messages_field ? sample[mapping.messages_field] : null

    return (
      <Card size="small" title="预览效果" style={{ marginTop: 16 }}>
        {context && (
          <div style={{ marginBottom: 8 }}>
            <Tag color="purple">系统上下文</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {String(context).slice(0, 100)}...
            </Text>
          </div>
        )}
        {messages ? (
          <div>
            <Tag color="blue">对话消息</Tag>
            <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
              {JSON.stringify(messages, null, 2)}
            </pre>
          </div>
        ) : (
          <>
            {question && (
              <div style={{ marginBottom: 8, padding: 8, background: '#f0f5ff', borderRadius: 4 }}>
                <Tag color="blue" icon={<QuestionCircleOutlined />}>
                  问题 ({mapping.question_field})
                </Tag>
                <div style={{ marginTop: 4 }}>{String(question).slice(0, 200)}</div>
              </div>
            )}
            {thinking && (
              <div style={{ marginBottom: 8, padding: 8, background: '#fffbe6', borderRadius: 4 }}>
                <Tag color="gold" icon={<BulbOutlined />}>
                  思考 ({mapping.thinking_field})
                </Tag>
                <div style={{ marginTop: 4 }}>{String(thinking).slice(0, 200)}</div>
              </div>
            )}
            {answer && (
              <div style={{ padding: 8, background: '#f6ffed', borderRadius: 4 }}>
                <Tag color="green" icon={<MessageOutlined />}>
                  回答 ({mapping.answer_field})
                </Tag>
                <div style={{ marginTop: 4 }}>{String(answer).slice(0, 200)}</div>
              </div>
            )}
          </>
        )}
      </Card>
    )
  }

  return (
    <div>
      {/* 检测到的字段 */}
      <Card size="small" title="检测到的字段" style={{ marginBottom: 16 }}>
        <Space wrap>
          {detectedFields.map((field) => (
            <Tag
              key={field}
              color={
                field === mapping.question_field
                  ? 'blue'
                  : field === mapping.answer_field
                    ? 'green'
                    : field === mapping.thinking_field
                      ? 'gold'
                      : field === mapping.context_field
                        ? 'purple'
                        : field === mapping.messages_field
                          ? 'cyan'
                          : 'default'
              }
            >
              {field}
            </Tag>
          ))}
        </Space>
        {showPreview && sampleData.length > 0 && (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setShowSamplePreview(!showSamplePreview)}
            style={{ marginTop: 8 }}
          >
            {showSamplePreview ? '隐藏' : '查看'}原始数据
          </Button>
        )}
        {showSamplePreview && (
          <Table
            size="small"
            style={{ marginTop: 8 }}
            dataSource={sampleData.slice(0, 3).map((d, i) => ({ ...d, _key: i }))}
            columns={detectedFields.slice(0, 6).map((field) => ({
              title: field,
              dataIndex: field,
              ellipsis: true,
              width: 150,
              render: (v: any) => (
                <Tooltip title={typeof v === 'object' ? JSON.stringify(v) : String(v)}>
                  <span style={{ fontSize: 11 }}>
                    {typeof v === 'object' ? '[Object]' : String(v).slice(0, 50)}
                  </span>
                </Tooltip>
              ),
            }))}
            rowKey="_key"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      {/* 字段映射配置 */}
      <Card
        size="small"
        title={
          <Space>
            <SettingOutlined />
            字段映射配置
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Form layout="vertical" size="small">
          <Form.Item
            label={
              <Space>
                显示模式
                <Tooltip title="选择数据的展示方式">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
          >
            <Radio.Group
              value={mapping.display_mode}
              onChange={(e) => updateMapping('display_mode', e.target.value)}
              disabled={readOnly}
            >
              <Radio.Button value="auto">自动检测</Radio.Button>
              <Radio.Button value="conversation">对话模式</Radio.Button>
              <Radio.Button value="qa_pair">问答对模式</Radio.Button>
              <Radio.Button value="plain">纯文本模式</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Divider style={{ margin: '12px 0' }}>主要字段</Divider>

          <Space style={{ width: '100%' }} direction="vertical">
            <Form.Item label="问题/用户输入字段" style={{ marginBottom: 8 }}>
              <Select
                value={mapping.question_field}
                onChange={(v) => updateMapping('question_field', v)}
                placeholder="选择问题字段"
                allowClear
                disabled={readOnly}
                style={{ width: 200 }}
              >
                {getAvailableFields('question_field').map((f) => (
                  <Option key={f} value={f}>
                    {f}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item label="回答/助手输出字段" style={{ marginBottom: 8 }}>
              <Select
                value={mapping.answer_field}
                onChange={(v) => updateMapping('answer_field', v)}
                placeholder="选择回答字段"
                allowClear
                disabled={readOnly}
                style={{ width: 200 }}
              >
                {getAvailableFields('answer_field').map((f) => (
                  <Option key={f} value={f}>
                    {f}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item label="思考过程字段（可选）" style={{ marginBottom: 8 }}>
              <Select
                value={mapping.thinking_field}
                onChange={(v) => updateMapping('thinking_field', v)}
                placeholder="选择思考字段"
                allowClear
                disabled={readOnly}
                style={{ width: 200 }}
              >
                {getAvailableFields('thinking_field').map((f) => (
                  <Option key={f} value={f}>
                    {f}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item label="上下文/系统提示字段（可选）" style={{ marginBottom: 8 }}>
              <Select
                value={mapping.context_field}
                onChange={(v) => updateMapping('context_field', v)}
                placeholder="选择上下文字段"
                allowClear
                disabled={readOnly}
                style={{ width: 200 }}
              >
                {getAvailableFields('context_field').map((f) => (
                  <Option key={f} value={f}>
                    {f}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item label="对话消息数组字段（messages格式）" style={{ marginBottom: 8 }}>
              <Select
                value={mapping.messages_field}
                onChange={(v) => updateMapping('messages_field', v)}
                placeholder="选择消息字段"
                allowClear
                disabled={readOnly}
                style={{ width: 200 }}
              >
                {getAvailableFields('messages_field').map((f) => (
                  <Option key={f} value={f}>
                    {f}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {(mapping.display_mode === 'conversation' || mapping.messages_field) && (
              <Card
                size="small"
                type="inner"
                title="多轮对话详细配置"
                style={{ marginBottom: 8, background: '#fafafa' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Form.Item label="角色字段名" style={{ marginBottom: 0 }}>
                      <Input
                        value={mapping.message_role_field}
                        onChange={(e) => updateMapping('message_role_field', e.target.value)}
                        placeholder="默认为 role"
                        style={{ width: 120 }}
                      />
                    </Form.Item>
                    <Form.Item label="内容字段名" style={{ marginBottom: 0 }}>
                      <Input
                        value={mapping.message_content_field}
                        onChange={(e) => updateMapping('message_content_field', e.target.value)}
                        placeholder="默认为 content"
                        style={{ width: 120 }}
                      />
                    </Form.Item>
                  </Space>
                  <Space>
                    <Form.Item label="用户角色值" style={{ marginBottom: 0 }}>
                      <Input
                        value={mapping.user_role_value}
                        onChange={(e) => updateMapping('user_role_value', e.target.value)}
                        placeholder="默认为 user"
                        style={{ width: 120 }}
                      />
                    </Form.Item>
                    <Form.Item label="助手角色值" style={{ marginBottom: 0 }}>
                      <Input
                        value={mapping.assistant_role_value}
                        onChange={(e) => updateMapping('assistant_role_value', e.target.value)}
                        placeholder="默认为 assistant"
                        style={{ width: 120 }}
                      />
                    </Form.Item>
                    <Form.Item label="系统角色值" style={{ marginBottom: 0 }}>
                      <Input
                        value={mapping.system_role_value}
                        onChange={(e) => updateMapping('system_role_value', e.target.value)}
                        placeholder="默认为 system"
                        style={{ width: 120 }}
                      />
                    </Form.Item>
                  </Space>
                </Space>
              </Card>
            )}

            <Form.Item label="元数据字段（只读显示）" style={{ marginBottom: 8 }}>
              <Select
                mode="multiple"
                value={mapping.metadata_fields}
                onChange={(v) => updateMapping('metadata_fields', v)}
                placeholder="选择元数据字段"
                disabled={readOnly}
                style={{ width: '100%' }}
              >
                {detectedFields.map((f) => (
                  <Option key={f} value={f}>
                    {f}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Divider style={{ margin: '12px 0' }}>多模态配置</Divider>
            <Form.Item label="图片字段/文件夹" style={{ marginBottom: 8 }}>
              <Select
                value={mapping.image_field}
                onChange={(v) => updateMapping('image_field', v)}
                placeholder="选择图片路径字段"
                allowClear
                disabled={readOnly}
                style={{ width: 200 }}
              >
                {getAvailableFields('image_field').map((f) => (
                  <Option key={f} value={f}>
                    {f}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Space>
        </Form>
      </Card>

      {/* 审核规则配置 */}
      <Card
        size="small"
        title={
          <Space>
            <FileTextOutlined />
            审核规则配置
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Form layout="vertical" size="small">
          <Form.Item label="拒绝时必须填写原因">
            <Switch
              checked={reviewConfig.require_reason}
              onChange={(v) => updateReviewConfig('require_reason', v)}
              disabled={readOnly}
            />
          </Form.Item>

          <Form.Item label="允许编辑内容">
            <Switch
              checked={reviewConfig.allow_edit}
              onChange={(v) => updateReviewConfig('allow_edit', v)}
              disabled={readOnly}
            />
          </Form.Item>

          <Form.Item label="审核模式">
            <Radio.Group
              value={reviewConfig.review_mode}
              onChange={(e) => updateReviewConfig('review_mode', e.target.value)}
              disabled={readOnly}
            >
              <Radio value="single">单次审核</Radio>
              <Radio value="double">双重审核</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Card>

      {/* 预览效果 */}
      {showPreview && renderPreview()}

      {/* 保存按钮 */}
      {onSave && !readOnly && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button type="primary" onClick={() => onSave(mapping, reviewConfig)}>
            保存配置
          </Button>
        </div>
      )}
    </div>
  )
}
