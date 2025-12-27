import { EditOutlined, EyeOutlined, LockOutlined, MessageOutlined } from '@ant-design/icons'
import { Button, ConfigProvider, Layout, Result, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { shareApi } from '../services/api'
import ReviewPageV2 from './ReviewPageV2'

const { Header, Content } = Layout

interface ShareInfo {
  dataset_id: number
  dataset_name: string
  permission: string
  is_valid: boolean
  message?: string
}

const permissionIcons: Record<string, React.ReactNode> = {
  view: <EyeOutlined />,
  comment: <MessageOutlined />,
  edit: <EditOutlined />,
}

const permissionLabels: Record<string, string> = {
  view: '仅查看',
  comment: '可评论',
  edit: '可编辑',
}

export default function ShareAccessPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      validateAndAccess(token)
    }
  }, [token])

  const validateAndAccess = async (shareToken: string) => {
    setLoading(true)
    try {
      // 验证链接有效性
      const validateRes = await shareApi.validate(shareToken)
      if (!validateRes.data.is_valid) {
        setError(validateRes.data.message || '链接无效')
        return
      }

      // 记录访问
      const accessRes = await shareApi.access(shareToken)
      setShareInfo({
        ...validateRes.data,
        ...accessRes.data,
      })
    } catch (err: any) {
      setError(err.response?.data?.detail || '访问失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" tip="验证链接中..." />
      </div>
    )
  }

  if (error) {
    return (
      <Result
        status="error"
        icon={<LockOutlined style={{ fontSize: 80, color: '#ff4d4f' }} />}
        title="无法访问"
        subTitle={error}
        extra={[
          <Button key="login" type="primary" onClick={() => navigate('/login')}>
            登录账号
          </Button>,
        ]}
      />
    )
  }

  if (!shareInfo) {
    return <Result status="404" title="链接不存在" />
  }

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20, fontWeight: 600 }}>📊 {shareInfo.dataset_name}</span>
            <span
              style={{
                background: '#f0f0f0',
                padding: '4px 12px',
                borderRadius: 16,
                fontSize: 13,
              }}
            >
              {permissionIcons[shareInfo.permission]} {permissionLabels[shareInfo.permission]}
            </span>
          </div>
          <Button onClick={() => navigate('/login')}>登录账号</Button>
        </Header>
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <ReviewPageV2 shareToken={token} sharePermission={shareInfo.permission} />
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
