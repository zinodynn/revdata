import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, message, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import rocketImg from '../assert/riding_the_rocket.png'
import moonImg from '../assert/moon.png'

const { Title } = Typography

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [rocketAnimated, setRocketAnimated] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  useEffect(() => {
    // 延迟启动火箭飞入动画
    const timer = setTimeout(() => setRocketAnimated(true), 200)
    return () => clearTimeout(timer)
  }, [])

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      // 登录获取token
      const loginRes = await authApi.login(values.username, values.password)
      const { access_token } = loginRes.data

      // 临时设置token以获取用户信息
      useAuthStore.setState({ token: access_token })

      // 获取用户信息
      const userRes = await authApi.getMe()
      const user = userRes.data

      // 保存认证状态
      setAuth(access_token, user)
      message.success('登录成功')
      navigate('/')
    } catch (error: any) {
      message.error(error.response?.data?.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
        padding: '40px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 流光效果 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2) 0%, transparent 50%), ' +
            'radial-gradient(circle at 80% 80%, rgba(255,255,255,0.15) 0%, transparent 50%), ' +
            'radial-gradient(circle at 40% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          animation: 'shimmer 8s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* 月亮背景 */}
      <img
        src={moonImg}
        alt="moon"
        style={{
          position: 'absolute',
          left: '15%',
          top: '20%',
          width: '450px',
          height: '450px',
          opacity: 0.9,
          filter: 'drop-shadow(0 0 40px rgba(255, 255, 255, 0.3))',
          animation: 'float 6s ease-in-out infinite',
        }}
      />

      {/* 火箭飞行动画 */}
      <img
        src={rocketImg}
        alt="rocket"
        style={{
          position: 'absolute',
          left: rocketAnimated ? '18%' : '120%',
          top: rocketAnimated ? '22%' : '120%',
          width: '380px',
          height: 'auto',
          transform: rocketAnimated ? 'rotate(-15deg)' : 'rotate(45deg)',
          transition: 'all 1.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          filter: 'drop-shadow(0 8px 20px rgba(102, 126, 234, 0.4))',
          animation: rocketAnimated ? 'sway 3s ease-in-out infinite 1.8s' : 'none',
          zIndex: 2,
        }}
      />

      {/* 登录表单容器 */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          marginLeft: 'auto',
          marginRight: '8%',
          width: '420px',
        }}
      >
        <Card
          style={{
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Title level={2} style={{ marginBottom: 8, color: '#667eea' }}>
              Enter Our Platform
            </Title>
            <Typography.Text type="secondary" style={{ fontSize: '16px' }}>
              数据集审核平台
            </Typography.Text>
          </div>

          <Form name="login" onFinish={onFinish} size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input
                prefix={<UserOutlined style={{ color: '#667eea' }} />}
                placeholder="Enter Email Or Number"
                style={{ borderRadius: '8px', padding: '12px' }}
              />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password
                prefix={<LockOutlined style={{ color: '#667eea' }} />}
                placeholder="Password"
                style={{ borderRadius: '8px', padding: '12px' }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: '48px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 600,
                }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>

      <style>{`
        @keyframes shimmer {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes sway {
          0%, 100% {
            transform: translateY(0) rotate(-15deg);
          }
          50% {
            transform: translateY(-15px) rotate(-18deg);
          }
        }
      `}</style>
    </div>
  )
}
