import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, message, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import moonImg from '../../assert/moon.png'
import rocketImg from '../../assert/riding_the_rocket.png'
import { authApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'

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
        padding: '40px 20px',
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

      {/* 浅色背景框 */}
      <div
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: '1400px',
          height: '85vh',
          minHeight: '650px',
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(20px)',
          borderRadius: '32px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 80px',
          overflow: 'hidden',
        }}
      >
        {/* 月亮背景 */}
        <img
          src={moonImg}
          alt="moon"
          style={{
            position: 'absolute',
            left: '5%',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '600px',
            height: '600px',
            maxWidth: '45vw',
            maxHeight: '45vw',
            opacity: 0.8,
            filter: 'drop-shadow(0 0 60px rgba(255, 255, 255, 0.5))',
            animation: 'float 6s ease-in-out infinite',
          }}
        />

        {/* 火箭飞行动画 - 从左下角飞入 */}
        <img
          src={rocketImg}
          alt="rocket"
          style={{
            position: 'absolute',
            left: rocketAnimated ? '8%' : '-25%',
            top: rocketAnimated ? '50%' : '120%',
            transform: rocketAnimated
              ? 'translateY(-50%) rotate(-20deg)'
              : 'translateY(-50%) rotate(-45deg)',
            width: '480px',
            maxWidth: '35vw',
            height: 'auto',
            transition: 'all 2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            filter: 'drop-shadow(0 10px 40px rgba(102, 126, 234, 0.6))',
            animation: rocketAnimated ? 'sway 3s ease-in-out infinite 2s' : 'none',
            zIndex: 2,
          }}
        />

        {/* 登录表单容器 */}
        <div
          style={{
            position: 'relative',
            zIndex: 3,
            marginLeft: 'auto',
            width: '450px',
            maxWidth: '40%',
          }}
        >
          <Card
            style={{
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.8)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <Title level={2} style={{ marginBottom: 12, color: '#667eea', fontSize: '32px' }}>
                Enter Our Platform
              </Title>
              <Typography.Text type="secondary" style={{ fontSize: '15px', color: '#8b8b8b' }}>
                数据集审核平台
              </Typography.Text>
            </div>

            <Form name="login" onFinish={onFinish} size="large">
              <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input
                  prefix={<UserOutlined style={{ color: '#667eea' }} />}
                  placeholder="Enter Email Or Number"
                  style={{
                    borderRadius: '10px',
                    padding: '14px',
                    fontSize: '15px',
                    border: '1px solid #e0e0e0',
                  }}
                />
              </Form.Item>

              <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#667eea' }} />}
                  placeholder="Password"
                  style={{
                    borderRadius: '10px',
                    padding: '14px',
                    fontSize: '15px',
                    border: '1px solid #e0e0e0',
                  }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={{
                    height: '52px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    fontSize: '17px',
                    fontWeight: 600,
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
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
            transform: translateY(-50%) rotate(-20deg);
          }
          50% {
            transform: translateY(calc(-50% - 12px)) rotate(-22deg);
          }
        }
      `}</style>
      </div>
    </div>
  )
}
