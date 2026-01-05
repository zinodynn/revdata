import {
  CheckSquareOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Layout as AntLayout,
  Avatar,
  Badge,
  Button,
  ConfigProvider,
  Dropdown,
  Menu,
  theme,
} from 'antd'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { tasksApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import SettingsModal from './SettingsModal'

const { Header, Sider, Content } = AntLayout

// 深色主题配置
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

// 浅色主题配置
const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#1890ff',
  },
}

export default function LayoutV2() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { theme: appTheme, toggleTheme, siderCollapsed, setSiderCollapsed } = useSettingsStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [unreadTaskCount, setUnreadTaskCount] = useState(0)

  // 判断是否为管理员
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  // 获取未读任务数量
  const fetchUnreadTaskCount = async () => {
    try {
      const res = await tasksApi.assignedByMe()
      const tasks = res.data.items || res.data
      const count = tasks.filter(
        (t: any) => t.status === 'completed' && !t.reviewed_by_assigner,
      ).length
      setUnreadTaskCount(count)
    } catch (error) {
      console.error('获取未读任务数量失败', error)
    }
  }

  // 非管理员默认收起侧边栏
  useEffect(() => {
    if (!isAdmin) {
      setSiderCollapsed(true)
    }
  }, [isAdmin, setSiderCollapsed])

  // 定期获取未读任务数量
  useEffect(() => {
    if (user) {
      fetchUnreadTaskCount()
      const interval = setInterval(fetchUnreadTaskCount, 30000) // 每30秒刷新一次
      return () => clearInterval(interval)
    }
  }, [user])

  // 根据角色生成菜单
  const menuItems = isAdmin
    ? [
        {
          key: '/datasets',
          icon: <DatabaseOutlined />,
          label: '数据集管理',
        },
        {
          key: '/tasks',
          icon: <CheckSquareOutlined />,
          label: (
            <Badge dot={unreadTaskCount > 0} offset={[10, 0]}>
              审核任务
            </Badge>
          ),
        },
        {
          key: '/members',
          icon: <TeamOutlined />,
          label: '成员管理',
        },
      ]
    : [
        {
          key: '/tasks',
          icon: <CheckSquareOutlined />,
          label: (
            <Badge dot={unreadTaskCount > 0} offset={[10, 0]}>
              我的审核
            </Badge>
          ),
        },
      ]

  const userMenuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => setSettingsOpen(true),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  const isDark = appTheme === 'dark'

  return (
    <ConfigProvider theme={isDark ? darkTheme : lightTheme}>
      <AntLayout style={{ minHeight: '100vh' }}>
        {/* 侧边栏 - 审核员默认收起 */}
        <Sider
          theme={isDark ? 'dark' : 'light'}
          width={200}
          collapsible
          collapsed={siderCollapsed}
          onCollapse={setSiderCollapsed}
          trigger={null}
          collapsedWidth={isAdmin ? 80 : 0}
          style={{
            borderRight: isDark ? '1px solid #434343' : '1px solid #f0f0f0',
          }}
        >
          <div
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: isDark ? '1px solid #434343' : '1px solid #f0f0f0',
            }}
          >
            {!siderCollapsed && <h2 style={{ margin: 0, color: '#1890ff' }}>📊 RevData</h2>}
            {siderCollapsed && <span style={{ fontSize: 24 }}>📊</span>}
          </div>
          <Menu
            mode="inline"
            theme={isDark ? 'dark' : 'light'}
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0 }}
          />
        </Sider>

        <AntLayout>
          <Header
            style={{
              background: isDark ? '#1f1f1f' : '#fff',
              padding: '0 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: isDark ? '1px solid #434343' : '1px solid #f0f0f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button
                type="text"
                icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setSiderCollapsed(!siderCollapsed)}
              />
              {!isAdmin && (
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: isDark ? '#e8e8e8' : '#333',
                  }}
                >
                  审核清单
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* 主题切换 */}
              <Button
                type="text"
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleTheme}
                title={isDark ? '切换到浅色模式' : '切换到深色模式'}
              />

              {/* 设置按钮 */}
              <Button
                type="text"
                icon={<SettingOutlined />}
                onClick={() => setSettingsOpen(true)}
                title="设置"
              />

              {/* 用户菜单 */}
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Button type="text" style={{ height: 'auto' }}>
                  <Avatar
                    icon={<UserOutlined />}
                    size="small"
                    style={{
                      marginRight: 8,
                      background: isAdmin ? '#52c41a' : '#1890ff',
                    }}
                  />
                  <span style={{ color: isDark ? '#e8e8e8' : undefined }}>
                    {user?.username}
                    {user?.role === 'super_admin' && (
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 11,
                          color: '#52c41a',
                        }}
                      >
                        (超级管理员)
                      </span>
                    )}
                    {user?.role === 'admin' && (
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 11,
                          color: '#52c41a',
                        }}
                      >
                        (管理员)
                      </span>
                    )}
                  </span>
                </Button>
              </Dropdown>
            </div>
          </Header>

          <Content
            style={{
              margin: 24,
              background: isDark ? '#1f1f1f' : '#fff',
              padding: 24,
              borderRadius: 8,
              minHeight: 'calc(100vh - 112px)',
            }}
          >
            <Outlet />
          </Content>
        </AntLayout>

        {/* 设置弹窗 */}
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </AntLayout>
    </ConfigProvider>
  )
}
