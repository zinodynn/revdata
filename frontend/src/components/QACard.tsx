import { BulbOutlined, EditOutlined } from '@ant-design/icons'
import { Button, Collapse, Tag, Typography } from 'antd'
import { useMemo } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

const { Text } = Typography

export interface FieldMappingConfig {
  question_field: string | null
  answer_field: string | null
  thinking_field: string | null
  context_field: string | null
  messages_field: string | null
  metadata_fields: string[]
  display_mode: 'conversation' | 'qa_pair' | 'plain' | 'auto'
}

interface QACardProps {
  itemType: 'plain' | 'qa'
  originalContent: any
  currentContent: any
  hasChanges: boolean
  seqNum: number
  onEditQ?: () => void
  onEditA?: () => void
  isEditing?: boolean
  theme?: 'light' | 'dark'
  fieldMapping?: FieldMappingConfig // 新增：字段映射配置
}

/**
 * 优化的QA卡片组件
 * - 参考设计稿的分栏布局
 * - 左侧用户/问题，右侧助手/回答
 * - 有编辑按钮
 * - 支持深色模式
 * - 支持动态字段映射
 */
export default function QACard({
  itemType,
  originalContent,
  currentContent,
  hasChanges,
  seqNum,
  onEditQ,
  onEditA,
  isEditing,
  theme = 'light',
  fieldMapping,
}: QACardProps) {
  const isDark = theme === 'dark'

  // 根据字段映射提取QA内容
  const getQAContent = (
    content: any,
  ): { question: string; answer: string; thinking?: string; context?: string } => {
    if (!content) return { question: '', answer: '' }

    // 如果有字段映射配置，优先使用
    if (fieldMapping) {
      // 消息数组格式
      if (fieldMapping.messages_field && content[fieldMapping.messages_field]) {
        const messages = content[fieldMapping.messages_field]
        if (Array.isArray(messages)) {
          const q = messages.find((m: any) => m.role === 'user' || m.role === 'human')
          const a = messages.find((m: any) => m.role === 'assistant' || m.role === 'ai')
          return {
            question: q?.content || '',
            answer: a?.content || '',
            thinking: fieldMapping.thinking_field
              ? content[fieldMapping.thinking_field]
              : undefined,
            context: fieldMapping.context_field ? content[fieldMapping.context_field] : undefined,
          }
        }
      }

      // 直接字段映射
      return {
        question: fieldMapping.question_field
          ? String(content[fieldMapping.question_field] || '')
          : '',
        answer: fieldMapping.answer_field ? String(content[fieldMapping.answer_field] || '') : '',
        thinking: fieldMapping.thinking_field
          ? String(content[fieldMapping.thinking_field] || '')
          : undefined,
        context: fieldMapping.context_field
          ? String(content[fieldMapping.context_field] || '')
          : undefined,
      }
    }

    // 默认回退：自动检测
    if (content.messages && Array.isArray(content.messages)) {
      const q = content.messages.find((m: any) => m.role === 'user' || m.role === 'human')
      const a = content.messages.find((m: any) => m.role === 'assistant' || m.role === 'ai')
      return {
        question: q?.content || '',
        answer: a?.content || '',
      }
    }

    return {
      question: content.question || content.instruction || content.prompt || content.input || '',
      answer: content.answer || content.output || content.completion || content.response || '',
      thinking: content.thinking || content.reasoning || content.thought || undefined,
      context: content.system || content.system_prompt || content.context || undefined,
    }
  }

  // 提取纯文本
  const getText = (content: any): string => {
    if (!content) return ''
    if (typeof content === 'string') return content
    if (content.text) return content.text
    if (content.content) return content.content
    return JSON.stringify(content, null, 2)
  }

  const originalQA = getQAContent(originalContent)
  const currentQA = getQAContent(currentContent)
  const qHasChanges = originalQA.question !== currentQA.question
  const aHasChanges = originalQA.answer !== currentQA.answer
  const thinkingHasChanges = originalQA.thinking !== currentQA.thinking

  // 获取元数据
  const getMetadata = (content: any): Record<string, any> => {
    if (!content || !fieldMapping?.metadata_fields?.length) return {}
    const meta: Record<string, any> = {}
    for (const field of fieldMapping.metadata_fields) {
      if (content[field] !== undefined) {
        meta[field] = content[field]
      }
    }
    return meta
  }
  const metadata = getMetadata(currentContent)

  const diffStyles = useMemo(
    () => ({
      variables: {
        light: {
          diffViewerBackground: '#fff',
          addedBackground: '#e6ffed',
          addedColor: '#22863a',
          removedBackground: '#ffeef0',
          removedColor: '#cb2431',
          wordAddedBackground: '#acf2bd',
          wordRemovedBackground: '#fdb8c0',
        },
        dark: {
          diffViewerBackground: '#1f1f1f',
          addedBackground: '#1f3d2a',
          addedColor: '#7ee787',
          removedBackground: '#442726',
          removedColor: '#f85149',
          wordAddedBackground: '#2ea043',
          wordRemovedBackground: '#f85149',
        },
      },
      line: {
        padding: '4px 8px',
        fontSize: '14px',
        lineHeight: '1.6',
      },
    }),
    [],
  )

  // 纯文本类型
  if (itemType !== 'qa') {
    const originalText = getText(originalContent)
    const currentText = getText(currentContent)

    return (
      <div
        className="plain-card"
        style={{
          padding: 24,
          background: isDark ? '#2a2a2a' : '#f5f7fa',
          borderRadius: 12,
          border: isDark ? '1px solid #434343' : '1px solid #e8e8e8',
        }}
      >
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <Text style={{ color: isDark ? '#b0b0b0' : '#666' }}>
            这是第 <strong style={{ color: isDark ? '#fff' : '#000' }}>{seqNum}</strong>{' '}
            条单栏文本数据。 包含一些需要审核的内容，可能需要修正语法、错别字或者格心问题。
          </Text>
          {!isEditing && onEditQ && (
            <Button type="primary" icon={<EditOutlined />} onClick={onEditQ}>
              编辑内容 (q)
            </Button>
          )}
        </div>
        {hasChanges ? (
          <ReactDiffViewer
            oldValue={originalText}
            newValue={currentText}
            splitView={false}
            compareMethod={DiffMethod.CHARS}
            hideLineNumbers
            styles={diffStyles}
            useDarkTheme={isDark}
          />
        ) : (
          <div
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.8,
              color: isDark ? '#e8e8e8' : '#333',
            }}
          >
            {currentText}
          </div>
        )}
      </div>
    )
  }

  // QA对话类型 - 分栏显示
  return (
    <div className="qa-card-wrapper">
      {/* 上下文/系统提示 */}
      {currentQA.context && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            background: isDark ? '#2a2a3a' : '#f9f0ff',
            border: isDark ? '1px solid #4a4a5a' : '1px solid #d3adf7',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            系统上下文:
          </Text>
          <div style={{ marginTop: 4, color: isDark ? '#d0d0d0' : '#531dab', fontSize: 13 }}>
            {currentQA.context}
          </div>
        </div>
      )}

      {/* 思考过程 */}
      {currentQA.thinking && (
        <Collapse
          ghost
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'thinking',
              label: (
                <span style={{ color: isDark ? '#faad14' : '#d48806' }}>
                  <BulbOutlined /> 思考过程
                  {thinkingHasChanges && (
                    <Tag color="gold" style={{ marginLeft: 8 }}>
                      已修改
                    </Tag>
                  )}
                </span>
              ),
              children: (
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                    color: isDark ? '#d0d0d0' : '#666',
                    fontSize: 13,
                    background: isDark ? '#2a2820' : '#fffbe6',
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  {thinkingHasChanges ? (
                    <ReactDiffViewer
                      oldValue={originalQA.thinking || ''}
                      newValue={currentQA.thinking}
                      splitView={false}
                      compareMethod={DiffMethod.CHARS}
                      hideLineNumbers
                      styles={diffStyles}
                      useDarkTheme={isDark}
                    />
                  ) : (
                    currentQA.thinking
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      {/* 元数据 */}
      {Object.keys(metadata).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {Object.entries(metadata).map(([key, value]) => (
            <Tag key={key} style={{ marginBottom: 4 }}>
              {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </Tag>
          ))}
        </div>
      )}

      {/* 主内容 - 分栏 */}
      <div
        className="qa-card-container"
        style={{
          display: 'flex',
          gap: 24,
        }}
      >
        {/* 左侧 - 用户/问题 */}
        <div
          className="qa-column qa-user"
          style={{
            flex: 1,
            padding: 20,
            borderRadius: 12,
            background: isDark ? '#1e2838' : '#f0f5ff',
            border: isDark ? '1px solid #3a4a5c' : '1px solid #adc6ff',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div>
              <Text strong style={{ fontSize: 16, color: isDark ? '#e8e8e8' : '#333' }}>
                用户
              </Text>
              {qHasChanges && (
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  已修改
                </Tag>
              )}
            </div>
            {!isEditing && onEditQ && (
              <Button size="small" type="primary" icon={<EditOutlined />} onClick={onEditQ}>
                编辑 (q)
              </Button>
            )}
          </div>

          <Text
            type="secondary"
            style={{
              display: 'block',
              marginBottom: 12,
              fontSize: 13,
              color: isDark ? '#888' : '#666',
            }}
          >
            用户问题 {seqNum}：
          </Text>

          {qHasChanges ? (
            <div className="diff-content">
              <ReactDiffViewer
                oldValue={originalQA.question}
                newValue={currentQA.question}
                splitView={false}
                compareMethod={DiffMethod.CHARS}
                hideLineNumbers
                styles={diffStyles}
                useDarkTheme={isDark}
              />
            </div>
          ) : (
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                color: isDark ? '#e8e8e8' : '#333',
                fontSize: 14,
              }}
            >
              {currentQA.question}
            </div>
          )}
        </div>

        {/* 右侧 - 助手/回答 */}
        <div
          className="qa-column qa-assistant"
          style={{
            flex: 1,
            padding: 20,
            borderRadius: 12,
            background: isDark ? '#1e3828' : '#f6ffed',
            border: isDark ? '1px solid #3a5c4a' : '1px solid #b7eb8f',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div>
              <Text strong style={{ fontSize: 16, color: isDark ? '#e8e8e8' : '#333' }}>
                助手
              </Text>
              {aHasChanges && (
                <Tag color="green" style={{ marginLeft: 8 }}>
                  已修改
                </Tag>
              )}
            </div>
            {!isEditing && onEditA && (
              <Button size="small" type="primary" icon={<EditOutlined />} onClick={onEditA}>
                编辑 (a)
              </Button>
            )}
          </div>

          <Text
            type="secondary"
            style={{
              display: 'block',
              marginBottom: 12,
              fontSize: 13,
              color: isDark ? '#888' : '#666',
            }}
          >
            助手回答 {seqNum}：
          </Text>

          {aHasChanges ? (
            <div className="diff-content">
              <ReactDiffViewer
                oldValue={originalQA.answer}
                newValue={currentQA.answer}
                splitView={false}
                compareMethod={DiffMethod.CHARS}
                hideLineNumbers
                styles={diffStyles}
                useDarkTheme={isDark}
              />
            </div>
          ) : (
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                color: isDark ? '#e8e8e8' : '#333',
                fontSize: 14,
              }}
            >
              {currentQA.answer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
