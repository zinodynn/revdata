import {
  BulbOutlined,
  EditOutlined,
  LeftOutlined,
  PictureOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { Button, Collapse, Image, Input, Tag, Typography } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'

const { Text } = Typography
const { TextArea } = Input

export interface FieldMappingConfig {
  question_field: string | null
  answer_field: string | null
  thinking_field: string | null
  context_field: string | null
  messages_field: string | null
  metadata_fields: string[]
  display_mode: 'conversation' | 'qa_pair' | 'plain' | 'auto'
  image_field?: string

  // New multi-turn config
  message_role_field?: string
  message_content_field?: string
  user_role_value?: string
  assistant_role_value?: string
  system_role_value?: string
}

interface Message {
  role: string
  content: string
  images?: string[] // 多模态图片
}

interface QACardUnifiedProps {
  originalContent: any
  currentContent: any
  seqNum: number
  theme?: 'light' | 'dark'
  fieldMapping?: FieldMappingConfig
  datasetSourceFile?: string
  editingField?: string | null // 当前编辑的字段: 'q_0', 'a_0', 'q_1', 'a_1' ...
  onStartEdit?: (field: string) => void
  onContentChange?: (newContent: any) => void
  onSave?: () => void
  onCancel?: () => void
  readOnly?: boolean
}

/**
 * 统一展示编辑的QA卡片组件
 * - 展示和编辑一体化
 * - 左右分栏(Q/A)
 * - 支持多轮对话
 * - 原位显示diff(红绿变更)
 * - 支持多模态图片
 */
export default function QACardUnified({
  originalContent,
  currentContent,
  seqNum,
  theme = 'light',
  fieldMapping,
  datasetSourceFile,
  editingField,
  onStartEdit,
  onContentChange,
  onSave,
  onCancel,
  readOnly = false,
}: QACardUnifiedProps) {
  const isDark = theme === 'dark'
  const editRef = useRef<HTMLTextAreaElement>(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const hotkeys = useSettingsStore((state) => state.hotkeys)

  // 当 seqNum 改变时重置图片索引
  useEffect(() => {
    setActiveImageIndex(0)
  }, [seqNum])

  // 解析消息列表
  const parseMessages = (content: any): Message[] => {
    // debug: log incoming content keys
    try {
      console.debug(
        '[QACardUnified] parseMessages content keys',
        content && typeof content === 'object' ? Object.keys(content) : typeof content,
      )
      ;(window as any).__revdata_debug_logs = (window as any).__revdata_debug_logs || []
      ;(window as any).__revdata_debug_logs.push({
        tag: 'QACardUnified',
        t: Date.now(),
        type: 'parse_start',
        keys: content && typeof content === 'object' ? Object.keys(content) : null,
      })
    } catch (e) {
      // ignore
    }

    if (!content) return []

    // 规范化内容键（处理可能的 BOM 前缀或不可见字符）
    if (typeof content === 'object' && !Array.isArray(content)) {
      const normalized: any = {}
      for (const k of Object.keys(content)) {
        const nk = k.replace(/^\uFEFF+|^\u200b+|^\u200e+|^\u200f+/g, '')
        normalized[nk] = content[k]
      }
      content = normalized
    }

    // 规范化 fieldMapping 中的字段名（防止 fieldMapping 指向带不可见字符的键）
    let normalizedFieldMapping = fieldMapping
    if (fieldMapping) {
      const nf: any = { ...fieldMapping }
      if (nf.question_field)
        nf.question_field = String(nf.question_field).replace(
          /^\uFEFF+|^\u200b+|^\u200e+|^\u200f+/g,
          '',
        )
      if (nf.answer_field)
        nf.answer_field = String(nf.answer_field).replace(
          /^\uFEFF+|^\u200b+|^\u200e+|^\u200f+/g,
          '',
        )
      if (nf.messages_field)
        nf.messages_field = String(nf.messages_field).replace(
          /^\uFEFF+|^\u200b+|^\u200e+|^\u200f+/g,
          '',
        )
      if (nf.context_field)
        nf.context_field = String(nf.context_field).replace(
          /^\uFEFF+|^\u200b+|^\u200e+|^\u200f+/g,
          '',
        )
      if (nf.thinking_field)
        nf.thinking_field = String(nf.thinking_field).replace(
          /^\uFEFF+|^\u200b+|^\u200e+|^\u200f+/g,
          '',
        )
      if (nf.metadata_fields && Array.isArray(nf.metadata_fields))
        nf.metadata_fields = nf.metadata_fields.map((m: string) =>
          String(m).replace(/^\uFEFF+|^\u200b+|^\u200e+|^\u200f+/g, ''),
        )
      normalizedFieldMapping = nf
    }

    // 优先使用field_mapping
    if (fieldMapping?.messages_field && content[fieldMapping.messages_field]) {
      const msgs = content[fieldMapping.messages_field]
      const roleKey = fieldMapping.message_role_field || 'role'
      const contentKey = fieldMapping.message_content_field || 'content'
      const userVal = fieldMapping.user_role_value || 'user'
      const assistantVal = fieldMapping.assistant_role_value || 'assistant'

      if (Array.isArray(msgs) && msgs.length > 0) {
        return msgs.map((m: any, idx: number) => {
          let r = m[roleKey]
          if (!r) {
            // 尝试自动推断
            r = idx % 2 === 0 ? 'user' : 'assistant'
          }

          if (r === userVal) r = 'user'
          else if (r === assistantVal) r = 'assistant'

          return {
            role: r || 'user',
            content: String(m[contentKey] || ''),
            images: m.images,
          }
        })
      }
    }

    // 默认messages格式
    if (content.messages && Array.isArray(content.messages)) {
      return content.messages.map((m: any, idx: number) => ({
        role: m.role || (idx % 2 === 0 ? 'user' : 'assistant'),
        content: String(m.content || ''),
        images: m.images,
      }))
    }

    // conversations格式 (ShareGPT等)
    if (content.conversations && Array.isArray(content.conversations)) {
      return content.conversations.map((m: any) => ({
        role: m.from === 'human' ? 'user' : m.from === 'gpt' ? 'assistant' : m.role || 'user',
        content: String(m.value || m.content || ''),
        images: m.images,
      }))
    }

    // QA对格式转换为messages（使用规范化后的 fieldMapping）
    const q = normalizedFieldMapping?.question_field
      ? content[normalizedFieldMapping.question_field]
      : content.question ||
        content.instruction ||
        content.prompt ||
        content.input ||
        content.query ||
        content.user
    const a = normalizedFieldMapping?.answer_field
      ? content[normalizedFieldMapping.answer_field]
      : content.answer ||
        content.output ||
        content.completion ||
        content.response ||
        content.assistant

    // debug：记录 q/a 的解析结果
    try {
      console.debug('[QACardUnified] resolved q/a', { q, a, keys: Object.keys(content) })
      ;(window as any).__revdata_debug_logs = (window as any).__revdata_debug_logs || []
      ;(window as any).__revdata_debug_logs.push({
        tag: 'QACardUnified',
        t: Date.now(),
        type: 'resolved_qa',
        q: q ?? null,
        a: a ?? null,
        keys: Object.keys(content),
      })
    } catch (e) {
      // ignore
    }

    if (q !== undefined || a !== undefined) {
      return [
        { role: 'user', content: String(q ?? '') },
        { role: 'assistant', content: String(a ?? '') },
      ]
    }

    // 纯文本
    const text = content.text || content.content || (typeof content === 'string' ? content : '')
    if (text) {
      return [{ role: 'plain', content: String(text) }]
    }

    // 最后尝试：如果content是对象，尝试显示第一个字符串字段
    if (typeof content === 'object') {
      for (const key of Object.keys(content)) {
        if (typeof content[key] === 'string' && content[key].length > 0) {
          return [{ role: 'plain', content: `${key}: ${content[key]}` }]
        }
      }
      // 如果还是没有，显示JSON
      return [{ role: 'plain', content: JSON.stringify(content, null, 2) }]
    }

    return []
  }

  const originalMessages = useMemo(
    () => parseMessages(originalContent),
    [originalContent, fieldMapping],
  )
  const currentMessages = useMemo(
    () => parseMessages(currentContent),
    [currentContent, fieldMapping],
  )

  // debug parsed messages
  useEffect(() => {
    try {
      console.debug('[QACardUnified] parsed messages', { originalMessages, currentMessages })
      ;(window as any).__revdata_debug_logs = (window as any).__revdata_debug_logs || []
      ;(window as any).__revdata_debug_logs.push({
        tag: 'QACardUnified',
        t: Date.now(),
        type: 'parsed_messages',
        original: originalMessages,
        current: currentMessages,
      })
    } catch (e) {
      // ignore
    }
  }, [originalMessages, currentMessages])

  // 判断是否是纯文本模式
  const isPlainText = currentMessages.length === 1 && currentMessages[0].role === 'plain'

  // 聚焦编辑框
  useEffect(() => {
    if (editingField && editRef.current) {
      try {
        console.debug('[QACardUnified] focus edit', editingField)
        ;(window as any).__revdata_debug_logs = (window as any).__revdata_debug_logs || []
        ;(window as any).__revdata_debug_logs.push({
          tag: 'QACardUnified',
          t: Date.now(),
          type: 'focus',
          editingField,
          valueLen: editRef.current?.value?.length,
        })
        editRef.current.focus()
        editRef.current.setSelectionRange(
          editRef.current.value.length,
          editRef.current.value.length,
        )
      } catch (e) {
        console.error('[QACardUnified] focus/edit setSelectionRange error', e, {
          editingField,
          valueLen: editRef.current?.value?.length,
        })
        ;(window as any).__revdata_debug_logs = (window as any).__revdata_debug_logs || []
        ;(window as any).__revdata_debug_logs.push({
          tag: 'QACardUnified',
          t: Date.now(),
          type: 'focus_error',
          err: String(e),
        })
      }
    }
  }, [editingField])

  // 更新消息内容
  const updateMessageContent = (
    index: number,
    _role: 'user' | 'assistant' | 'plain',
    newValue: string,
  ) => {
    if (!onContentChange || !currentContent) return

    // 深拷贝当前内容
    const newContent = JSON.parse(JSON.stringify(currentContent))

    // 根据原始数据格式更新
    if (fieldMapping?.messages_field && newContent[fieldMapping.messages_field]) {
      const msgs = newContent[fieldMapping.messages_field]
      if (Array.isArray(msgs) && msgs[index]) {
        // 使用配置的 content key，没有配置则默认 "content"
        const contentKey = fieldMapping.message_content_field || 'content'
        msgs[index][contentKey] = newValue
        onContentChange(newContent)
      }
    } else if (newContent.messages && Array.isArray(newContent.messages)) {
      if (newContent.messages[index]) {
        newContent.messages[index].content = newValue
        onContentChange(newContent)
      }
    } else if (newContent.conversations && Array.isArray(newContent.conversations)) {
      // ShareGPT格式
      newContent.conversations[index].value = newValue
      onContentChange(newContent)
    } else {
      // QA对格式 - 根据index判断是Q还是A
      const isQuestion = index === 0
      if (isQuestion) {
        const qField =
          fieldMapping?.question_field ||
          (newContent.question !== undefined
            ? 'question'
            : newContent.instruction !== undefined
              ? 'instruction'
              : newContent.prompt !== undefined
                ? 'prompt'
                : newContent.input !== undefined
                  ? 'input'
                  : newContent.query !== undefined
                    ? 'query'
                    : newContent.user !== undefined
                      ? 'user'
                      : 'question')
        newContent[qField] = newValue
      } else {
        const aField =
          fieldMapping?.answer_field ||
          (newContent.answer !== undefined
            ? 'answer'
            : newContent.output !== undefined
              ? 'output'
              : newContent.completion !== undefined
                ? 'completion'
                : newContent.response !== undefined
                  ? 'response'
                  : newContent.assistant !== undefined
                    ? 'assistant'
                    : 'answer')
        newContent[aField] = newValue
      }
      onContentChange(newContent)
    }
  }

  // 计算行内diff
  const getInlineDiff = (original: string, current: string): React.ReactNode => {
    if (original === current) {
      return <span>{current}</span>
    }

    // 简单的字符级diff
    const result: React.ReactNode[] = []
    let i = 0

    // 找到公共前缀
    while (i < original.length && i < current.length && original[i] === current[i]) {
      i++
    }
    if (i > 0) {
      result.push(<span key="prefix">{current.substring(0, i)}</span>)
    }

    // 找到公共后缀
    let oi = original.length - 1
    let ci = current.length - 1
    while (oi > i && ci > i && original[oi] === current[ci]) {
      oi--
      ci--
    }

    // 删除的部分
    if (oi >= i) {
      result.push(
        <span
          key="removed"
          style={{
            background: isDark ? '#442726' : '#ffeef0',
            color: isDark ? '#f85149' : '#cb2431',
            textDecoration: 'line-through',
          }}
        >
          {original.substring(i, oi + 1)}
        </span>,
      )
    }

    // 添加的部分
    if (ci >= i) {
      result.push(
        <span
          key="added"
          style={{
            background: isDark ? '#1f3d2a' : '#e6ffed',
            color: isDark ? '#7ee787' : '#22863a',
          }}
        >
          {current.substring(i, ci + 1)}
        </span>,
      )
    }

    // 公共后缀
    if (ci < current.length - 1) {
      result.push(<span key="suffix">{current.substring(ci + 1)}</span>)
    }

    return <>{result}</>
  }

  // 渲染单条消息
  const renderMessage = (
    msg: Message,
    originalMsg: Message | undefined,
    index: number,
    isUser: boolean,
  ) => {
    const fieldKey = `${isUser ? 'q' : 'a'}_${Math.floor(index / 2)}`
    const isEditing = editingField === fieldKey
    const hasChanges = originalMsg && msg.content !== originalMsg.content

    const bgColor = isUser ? (isDark ? '#1e2838' : '#f0f5ff') : isDark ? '#1e3828' : '#f6ffed'
    const borderColor = isUser ? (isDark ? '#3a4a5c' : '#adc6ff') : isDark ? '#3a5c4a' : '#b7eb8f'
    const editBorderColor = isUser ? '#1890ff' : '#52c41a'

    return (
      <div
        key={index}
        style={{
          flex: 1,
          padding: 16,
          borderRadius: 12,
          background: bgColor,
          border: isEditing ? `2px solid ${editBorderColor}` : `1px solid ${borderColor}`,
          minHeight: 150,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div>
            <Text strong style={{ color: isDark ? '#e8e8e8' : '#333', fontSize: 15 }}>
              {isUser ? '用户' : '助手'}
            </Text>
            {hasChanges && !isEditing && (
              <Tag color={isUser ? 'blue' : 'green'} style={{ marginLeft: 8 }}>
                已修改
              </Tag>
            )}
            {isEditing && (
              <Tag color="orange" style={{ marginLeft: 8 }}>
                编辑中
              </Tag>
            )}
          </div>
          {!readOnly && !isEditing && onStartEdit && (
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => onStartEdit(fieldKey)}
            >
              编辑 ({isUser ? hotkeys.focusQ : hotkeys.focusA})
            </Button>
          )}
          {isEditing && (
            <div>
              <Button size="small" type="primary" onClick={onSave} style={{ marginRight: 8 }}>
                保存 ({hotkeys.save.toUpperCase()})
              </Button>
              <Button size="small" onClick={onCancel}>
                取消 ({hotkeys.cancel})
              </Button>
            </div>
          )}
        </div>

        {/* 多模态图片 */}
        {msg.images && msg.images.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <PictureOutlined /> 附带图片:
            </Text>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {msg.images.map((img, imgIdx) => (
                <Image
                  key={imgIdx}
                  src={img}
                  width={120}
                  height={120}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                  fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesAVQYGAJnkWI0AAAAASUVORK5CYII="
                />
              ))}
            </div>
          </div>
        )}

        {/* 内容区域 */}
        <div style={{ flex: 1, width: '100%' }}>
          {isEditing ? (
            <TextArea
              ref={editRef as any}
              value={msg.content}
              onChange={(e) => updateMessageContent(index, msg.role as any, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                  e.preventDefault()

                  // 查找同角色的下一条消息
                  let nextIdx = -1
                  for (let i = index + 1; i < currentMessages.length; i++) {
                    const m = currentMessages[i]
                    const nextIsUser = m.role === 'user' || m.role === 'human'
                    if (nextIsUser === isUser) {
                      nextIdx = i
                      break
                    }
                  }

                  // 如果没找到，循环回到开头
                  if (nextIdx === -1) {
                    for (let i = 0; i < index; i++) {
                      const m = currentMessages[i]
                      const nextIsUser = m.role === 'user' || m.role === 'human'
                      if (nextIsUser === isUser) {
                        nextIdx = i
                        break
                      }
                    }
                  }

                  if (nextIdx !== -1 && onStartEdit) {
                    const nextKey = `${isUser ? 'q' : 'a'}_${Math.floor(nextIdx / 2)}`
                    onStartEdit(nextKey)
                  }
                }
              }}
              autoSize={{ minRows: 4, maxRows: 20 }}
              style={{
                background: isDark ? '#2a3a4a' : '#fff',
                color: isDark ? '#e8e8e8' : '#333',
                border: 'none',
                resize: 'none',
              }}
            />
          ) : (
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                color: isDark ? '#e8e8e8' : '#333',
                fontSize: 14,
                wordBreak: 'break-word',
              }}
            >
              {hasChanges && originalMsg
                ? getInlineDiff(originalMsg.content, msg.content)
                : msg.content}
            </div>
          )}
        </div>
      </div>
    )
  }

  // 获取上下文和思考内容
  const getContext = () => {
    if (fieldMapping?.context_field && currentContent?.[fieldMapping.context_field]) {
      return currentContent[fieldMapping.context_field]
    }
    return currentContent?.system || currentContent?.system_prompt || currentContent?.context
  }

  const getThinking = () => {
    if (fieldMapping?.thinking_field && currentContent?.[fieldMapping.thinking_field]) {
      return currentContent[fieldMapping.thinking_field]
    }
    return currentContent?.thinking || currentContent?.reasoning || currentContent?.thought
  }

  const context = getContext()
  const thinking = getThinking()

  // 解析图片
  const getImagesInfo = () => {
    // 1. 从 field_mapping 获取
    let imageSource = null
    if (fieldMapping?.image_field && currentContent?.[fieldMapping.image_field]) {
      imageSource = currentContent[fieldMapping.image_field]
    }
    // 2. 自动检测
    if (!imageSource && typeof currentContent === 'object') {
      if (currentContent.image) imageSource = currentContent.image
      else if (currentContent.images) imageSource = currentContent.images
    }

    if (!imageSource) return null

    const paths = Array.isArray(imageSource) ? imageSource : [imageSource]
    if (paths.length === 0) return null

    const images = paths
      .map((path) => {
        if (typeof path !== 'string') return null
        let imageUrl = path
        if (!path.startsWith('http') && !path.startsWith('data:')) {
          // 相对路径处理
          if (datasetSourceFile) {
            const parts = datasetSourceFile.split('/')
            const baseDir = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
            const normalizedBase = baseDir.replace(/\\/g, '/')
            if (normalizedBase) {
              imageUrl = `/static/${normalizedBase}/${path}`
            } else {
              imageUrl = `/static/${path}`
            }
          }
        }
        return { path, url: imageUrl }
      })
      .filter((i): i is { path: string; url: string } => i !== null)

    return images.length > 0 ? images : null
  }

  const imagesInfo = getImagesInfo()

  // 渲染单个内容区（右侧对话部分）
  const renderChatArea = () => {
    // 纯文本模式 - 单栏
    if (isPlainText) {
      const msg = currentMessages[0]
      const originalMsg = originalMessages[0]
      const hasChanges = originalMsg && msg.content !== originalMsg.content
      const isEditing = editingField === 'q_0'

      return (
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            background: isDark ? '#2a2a2a' : '#f5f7fa',
            border: isEditing
              ? '2px solid #1890ff'
              : isDark
                ? '1px solid #434343'
                : '1px solid #e8e8e8',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div>
              <Text strong style={{ color: isDark ? '#e8e8e8' : '#333' }}>
                第 {seqNum} 条
              </Text>
              {hasChanges && !isEditing && (
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  已修改
                </Tag>
              )}
              {isEditing && (
                <Tag color="orange" style={{ marginLeft: 8 }}>
                  编辑中
                </Tag>
              )}
            </div>
            {!readOnly && !isEditing && onStartEdit && (
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => onStartEdit('q_0')}
              >
                编辑 ({hotkeys.focusQ})
              </Button>
            )}
            {isEditing && (
              <div>
                <Button size="small" type="primary" onClick={onSave} style={{ marginRight: 8 }}>
                  保存 ({hotkeys.save.toUpperCase()})
                </Button>
                <Button size="small" onClick={onCancel}>
                  取消 ({hotkeys.cancel})
                </Button>
              </div>
            )}
          </div>

          {isEditing ? (
            <TextArea
              ref={editRef as any}
              value={msg.content}
              onChange={(e) => updateMessageContent(0, 'plain', e.target.value)}
              autoSize={{ minRows: 6, maxRows: 30 }}
              style={{
                background: isDark ? '#3a3a3a' : '#fff',
                color: isDark ? '#e8e8e8' : '#333',
              }}
            />
          ) : (
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                color: isDark ? '#e8e8e8' : '#333',
              }}
            >
              {hasChanges && originalMsg
                ? getInlineDiff(originalMsg.content, msg.content)
                : msg.content}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="qa-card-unified">
        {/* 上下文 */}
        {context && (
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
              {context}
            </div>
          </div>
        )}

        {/* 思考过程 */}
        {thinking && (
          <Collapse
            ghost
            style={{ marginBottom: 16 }}
            items={[
              {
                key: 'thinking',
                label: (
                  <span style={{ color: isDark ? '#faad14' : '#d48806' }}>
                    <BulbOutlined /> 思考过程
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
                    {thinking}
                  </div>
                ),
              },
            ]}
          />
        )}

        {/* 多轮对话 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {currentMessages.map((msg, idx) => {
            if (msg.role === 'plain') return null

            const isUser = msg.role === 'user' || msg.role === 'human'
            const originalMsg = originalMessages[idx]

            return (
              <div key={idx} style={{ width: '100%', maxWidth: 1000, marginBottom: 12 }}>
                {renderMessage(msg, originalMsg, idx, isUser)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // 最终渲染 Layout
  if (imagesInfo) {
    const currentImage = imagesInfo[activeImageIndex] || imagesInfo[0]
    return (
      <div style={{ display: 'flex', gap: 24, paddingBottom: 24 }}>
        {/* 左侧图片区 - 占据 40% 或 固定宽度 */}
        <div style={{ flex: '0 0 45%', maxWidth: '800px', minWidth: '300px' }}>
          <div style={{ position: 'sticky', top: 24, textAlign: 'center' }}>
            {/* 主图 */}
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
              <Image
                src={currentImage.url}
                style={{
                  maxWidth: '100%',
                  borderRadius: 8,
                  maxHeight: '70vh',
                  objectFit: 'contain',
                }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgesAVQYGAJnkWI0AAAAASUVORK5CYII="
              />
              {/* 左右切换按钮 (仅当有多张图时显示) */}
              {imagesInfo.length > 1 && (
                <>
                  <Button
                    shape="circle"
                    icon={<LeftOutlined />}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 10,
                      opacity: 0.7,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveImageIndex((prev) => (prev === 0 ? imagesInfo.length - 1 : prev - 1))
                    }}
                  />
                  <Button
                    shape="circle"
                    icon={<RightOutlined />}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 10,
                      opacity: 0.7,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveImageIndex((prev) => (prev === imagesInfo.length - 1 ? 0 : prev + 1))
                    }}
                  />
                </>
              )}
            </div>

            <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
              {imagesInfo.length > 1 && (
                <span style={{ marginRight: 8 }}>
                  ({activeImageIndex + 1}/{imagesInfo.length})
                </span>
              )}
              点击图片查看全图 (来源: {currentImage.path})
            </div>

            {/* 缩略图列表 */}
            {imagesInfo.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 16,
                  overflowX: 'auto',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                {imagesInfo.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      border:
                        idx === activeImageIndex ? '2px solid #1890ff' : '2px solid transparent',
                      borderRadius: 6,
                      cursor: 'pointer',
                      padding: 2,
                      opacity: idx === activeImageIndex ? 1 : 0.6,
                      transition: 'all 0.2s',
                    }}
                    onClick={() => setActiveImageIndex(idx)}
                  >
                    <img
                      src={img.url}
                      alt={`thumbnail-${idx}`}
                      style={{
                        width: 60,
                        height: 60,
                        objectFit: 'cover',
                        borderRadius: 4,
                        display: 'block',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧对话区 */}
        <div style={{ flex: 1 }}>{renderChatArea()}</div>
      </div>
    )
  }

  return renderChatArea()
}
