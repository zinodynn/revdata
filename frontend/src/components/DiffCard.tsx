import { Typography } from 'antd'
import { useMemo } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

const { Text } = Typography

interface DiffCardProps {
  itemType: 'plain' | 'qa'
  originalContent: any
  currentContent: any
  hasChanges: boolean
}

/**
 * 差异展示卡片组件
 * - 纯文本: 单栏展示
 * - QA对话: 左右分栏 (Q左 A右)
 * - 有修改时: 显示精确到字符级别的差异
 */
export default function DiffCard({
  itemType,
  originalContent,
  currentContent,
  hasChanges,
}: DiffCardProps) {
  // 提取文本内容
  const getText = (content: any): string => {
    if (!content) return ''
    if (typeof content === 'string') return content
    if (content.text) return content.text
    if (content.content) return content.content
    return JSON.stringify(content, null, 2)
  }

  // 提取QA内容
  const getQAContent = (content: any): { question: string; answer: string } => {
    if (!content) return { question: '', answer: '' }

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
    }
  }

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
          addedGutterBackground: '#cdffd8',
          removedGutterBackground: '#ffdce0',
          gutterBackground: '#f7f7f7',
          gutterBackgroundDark: '#f3f3f3',
          highlightBackground: '#fffbdd',
          highlightGutterBackground: '#fff5b1',
        },
      },
      line: {
        padding: '4px 8px',
        fontSize: '14px',
        lineHeight: '1.6',
      },
      contentText: {
        fontFamily: 'inherit',
      },
    }),
    [],
  )

  // QA类型展示
  if (itemType === 'qa') {
    const originalQA = getQAContent(originalContent)
    const currentQA = getQAContent(currentContent)

    const qHasChanges = originalQA.question !== currentQA.question
    const aHasChanges = originalQA.answer !== currentQA.answer

    return (
      <div className="qa-container">
        <div className="qa-column qa-question">
          <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 16 }}>
            问题 (Q)
            {qHasChanges && (
              <span style={{ color: '#1890ff', marginLeft: 8, fontSize: 12 }}>已修改</span>
            )}
          </Text>
          {qHasChanges ? (
            <ReactDiffViewer
              oldValue={originalQA.question}
              newValue={currentQA.question}
              splitView={false}
              compareMethod={DiffMethod.CHARS}
              hideLineNumbers={true}
              styles={diffStyles}
              useDarkTheme={false}
            />
          ) : (
            <div
              style={{
                whiteSpace: 'pre-wrap',
                padding: 12,
                background: '#fafafa',
                borderRadius: 6,
                lineHeight: 1.8,
              }}
            >
              {currentQA.question}
            </div>
          )}
        </div>
        <div className="qa-column qa-answer">
          <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 16 }}>
            回答 (A)
            {aHasChanges && (
              <span style={{ color: '#1890ff', marginLeft: 8, fontSize: 12 }}>已修改</span>
            )}
          </Text>
          {aHasChanges ? (
            <ReactDiffViewer
              oldValue={originalQA.answer}
              newValue={currentQA.answer}
              splitView={false}
              compareMethod={DiffMethod.CHARS}
              hideLineNumbers={true}
              styles={diffStyles}
              useDarkTheme={false}
            />
          ) : (
            <div
              style={{
                whiteSpace: 'pre-wrap',
                padding: 12,
                background: '#fafafa',
                borderRadius: 6,
                lineHeight: 1.8,
              }}
            >
              {currentQA.answer}
            </div>
          )}
        </div>
      </div>
    )
  }

  // 纯文本类型展示
  const originalText = getText(originalContent)
  const currentText = getText(currentContent)

  if (hasChanges) {
    return (
      <ReactDiffViewer
        oldValue={originalText}
        newValue={currentText}
        splitView={true}
        compareMethod={DiffMethod.CHARS}
        leftTitle="原始内容"
        rightTitle="当前内容"
        styles={diffStyles}
        useDarkTheme={false}
      />
    )
  }

  return (
    <div
      style={{
        whiteSpace: 'pre-wrap',
        padding: 16,
        background: '#fafafa',
        borderRadius: 8,
        lineHeight: 1.8,
        fontSize: 14,
      }}
    >
      {currentText}
    </div>
  )
}
