import { useEffect, useRef, useState } from 'react'

interface Props {
  docId: number
  name: string
  getUrl: (id: number) => string
}

export default function DocxPreview({ docId, name, getUrl }: Props) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchAndConvert() {
      setLoading(true)
      setError(null)
      setHtml(null)
      setIsPdf(false)
      try {
        const url = getUrl(docId)
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
        const contentType = res.headers.get('content-type') || ''
        const blob = await res.blob()

        // 如果是 PDF，直接创建 blob url 并用 iframe
        if (contentType.includes('application/pdf')) {
          console.log('[DocxPreview] Backend returned PDF')
          setIsPdf(true)
          const blobUrl = URL.createObjectURL(blob)
          setHtml(`<iframe src="${blobUrl}" style="width:100%;height:100%;border:none"></iframe>`)
          setLoading(false)
          return
        }

        // 尝试使用 mammoth 在浏览器端转换 docx -> html
        console.log('[DocxPreview] Backend returned Word, converting with mammoth')
        const arrayBuffer = await blob.arrayBuffer()
        const mammoth = await import('mammoth')
        const result = await mammoth.convertToHtml({ arrayBuffer })
        if (cancelled) return

        // 包装 HTML 并添加样式
        const styledHtml = `
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; line-height: 1.6; }
            p { margin: 0.5em 0; }
            h1, h2, h3, h4, h5, h6 { margin: 1em 0 0.5em; font-weight: bold; }
            table { border-collapse: collapse; width: 100%; margin: 1em 0; }
            td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            img { max-width: 100%; height: auto; margin: 10px 0; }
          </style>
          <div>${result.value}</div>
        `
        setHtml(styledHtml)
      } catch (err: any) {
        console.error('[DocxPreview] Conversion failed', err)
        setError('无法预览该文档，您可以下载后查看')
      } finally {
        setLoading(false)
      }
    }
    fetchAndConvert()
    return () => {
      cancelled = true
    }
  }, [docId, getUrl])

  if (loading) return <div style={{ padding: 24 }}>正在准备预览...</div>
  if (error)
    return (
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 12 }}>{error}</div>
        <a href={getUrl(docId)} target="_blank" rel="noreferrer">
          下载文档
        </a>
      </div>
    )

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {html ? (
        <div
          style={{ flex: 1, overflow: 'auto', padding: 12, boxSizing: 'border-box' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div>该文档无法预览</div>
      )}
    </div>
  )
}
