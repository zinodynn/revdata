import { ArrowRightOutlined, KeyOutlined } from '@ant-design/icons'
import { Button, Card, Input, message, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { authCodeApi } from '../services/api'

const { Title, Text, Paragraph } = Typography

/**
 * 授权码验证页面
 * - 6位数字授权码
 * - 无需登录
 * - 验证后进入审核页面
 */
export default function AuthCodePage() {
  const { code: urlCode } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const [code, setCode] = useState(urlCode || '')
  const [verifying, setVerifying] = useState(false)

  // 如果URL中有授权码，自动验证
  useEffect(() => {
    if (urlCode && urlCode.length === 6) {
      handleVerify(urlCode)
    }
  }, [urlCode])

  const handleVerify = async (inputCode?: string) => {
    const codeToVerify = inputCode || code
    if (codeToVerify.length !== 6) {
      message.error('请输入6位授权码')
      return
    }

    setVerifying(true)
    try {
      const res = await authCodeApi.verify(codeToVerify)
      if (res.data.valid) {
        // 存储授权码到session
        sessionStorage.setItem('auth_code', codeToVerify)
        sessionStorage.setItem(`auth_session_${codeToVerify}`, JSON.stringify(res.data))
        message.success('验证成功')
        // 跳转到授权审核页面
        navigate(`/auth-review/${codeToVerify}`)
      } else {
        message.error(res.data.message || '授权码无效')
      }
    } catch (error: any) {
      message.error(error.response?.data?.detail || '验证失败')
    } finally {
      setVerifying(false)
    }
  }

  // 只允许输入数字
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(value)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <KeyOutlined style={{ fontSize: 36, color: '#fff' }} />
          </div>
          <Title level={3} style={{ margin: 0 }}>
            输入授权码
          </Title>
          <Paragraph type="secondary" style={{ marginTop: 8 }}>
            请输入审核员提供的6位数字授权码
          </Paragraph>
        </div>

        <Input
          size="large"
          maxLength={6}
          value={code}
          onChange={handleCodeChange}
          placeholder="000000"
          style={{
            textAlign: 'center',
            fontSize: 32,
            letterSpacing: 8,
            height: 64,
            fontFamily: 'monospace',
          }}
          onPressEnter={() => handleVerify()}
        />

        <Button
          type="primary"
          size="large"
          block
          icon={<ArrowRightOutlined />}
          onClick={() => handleVerify()}
          loading={verifying}
          disabled={code.length !== 6}
          style={{ marginTop: 24, height: 48 }}
        >
          验证并进入
        </Button>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            授权码由审核员生成，用于临时访问审核数据
          </Text>
        </div>
      </Card>
    </div>
  )
}
