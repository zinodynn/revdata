import {
  CloseOutlined,
  LeftOutlined,
  MoonOutlined,
  RightOutlined,
  SettingOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { Button, ConfigProvider, Result, Space, Spin, Typography, message, theme } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate, useParams } from 'react-router-dom'
import QACardUnified from '../components/QACardUnified'
import SettingsModal from '../components/SettingsModal'
import { authCodeApi, publicItemsApi } from '../services/api'
import { useSettingsStore } from '../stores/settingsStore'

const { Title, Text } = Typography

interface AuthSession {
  valid: boolean
  dataset_id: number
  item_start: number
  item_end: number
  item_ids?: number[]
  permission: string
  session_token: string
}

/**
 * 授权码审核页面
 * - 无需登录，基于授权码session访问
 * - 功能等同于PureReviewPage
 * - 退出时释放在线计数
 */
export default function AuthReviewPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentItem, setCurrentItem] = useState<any>(null)
  const [currentIndex, setCurrentIndex] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  const sessionRef = useRef<AuthSession | null>(null)
  const { theme: appTheme, toggleTheme, hotkeys } = useSettingsStore()
  const isDark = appTheme === 'dark'

  // 验证授权码
  useEffect(() => {
    if (!code) {
      setError('未提供授权码')
      setLoading(false)
      return
    }

    const verify = async () => {
      try {
        const res = await authCodeApi.verify(code)
        if (res.data.valid) {
          setSession(res.data)
          if (res.data.item_ids && res.data.item_ids.length > 0) {
            setTotalItems(res.data.item_ids.length)
          } else {
            setTotalItems(res.data.item_end - res.data.item_start + 1)
          }
          setTotalItems(res.data.item_end - res.data.item_start + 1)
          // 存储session到sessionStorage
          sessionStorage.setItem(`auth_session_${code}`, JSON.stringify(res.data))
        } else {
          setError(res.data.message || '授权码验证失败')
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || '验证失败')
      } finally {
        setLoading(false)
      }
    }

    // 先检查sessionStorage是否有有效session
    const cached = sessionStorage.getItem(`auth_session_${code}`)
    if (cached) {
      try {
        const cachedSession = JSON.parse(cached)
        setSession(cachedSession)
        sessionRef.current = cachedSession
        if (cachedSession.item_ids && cachedSession.item_ids.length > 0) {
          setTotalItems(cachedSession.item_ids.length)
        } else {
          setTotalItems(cachedSession.item_end - cachedSession.item_start + 1)
        }
        setLoading(false)
      } catch {
        verify()
      }
    } else {
      verify()
    }
  }, [code])

  // 退出时释放在线计数
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionRef.current?.session_token) {
        // 使用sendBeacon确保请求发送
        const data = JSON.stringify({
          session_token: sessionRef.current.session_token,
        })
        navigator.sendBeacon('/api/v1/auth-codes/session/leave', data)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // 组件卸载时也尝试释放
      if (sessionRef.current?.session_token) {
        authCodeApi.leave(sessionRef.current.session_token).catch(() => {})
      }
    }
  }, [])

  // 获取语料
  const fetchItem = useCallback(
    async (index: number) => {
      if (!session) return

      setLoading(true)
      try {
        let res
        if (session.item_ids && session.item_ids.length > 0) {
          const itemId = session.item_ids[index - 1]
          res = await publicItemsApi.get(itemId, session.session_token)
        } else {
          const seqNum = session.item_start + index - 1
          res = await publicItemsApi.getBySeq(session.dataset_id, seqNum, session.session_token)
        }

        // 规范化服务器返回，防御性去掉键名前的不可见字符
        const { normalizeJsonKeys } = await import('../utils/json')
        const normalized = normalizeJsonKeys(res.data)
        setCurrentItem(normalized)
        setCurrentIndex(index)
        setEditingContent(JSON.parse(JSON.stringify(normalized.current_content)))
        setEditingField(null)
      } catch (err: any) {
        console.error('[AuthReviewPage] fetchItem error', err)
        ;(window as any).__revdata_debug_logs = (window as any).__revdata_debug_logs || []
        ;(window as any).__revdata_debug_logs.push({
          tag: 'AuthReviewPage',
          t: Date.now(),
          type: 'fetchItem_error',
          err: err?.response?.data || err?.message || String(err),
        })

        const status = err?.response?.status
        const detail =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          '获取语料失败'

        // 如果是认证/权限相关错误，尝试重新验证一次授权码后重试（一次性）
        if ((status === 401 || status === 403) && code) {
          try {
            const verifyRes = await authCodeApi.verify(code)
            if (verifyRes.data.valid) {
              setSession(verifyRes.data)
              sessionRef.current = verifyRes.data
              sessionStorage.setItem(`auth_session_${code}`, JSON.stringify(verifyRes.data))
              // 重试一次
              let retryRes
              if (verifyRes.data.item_ids && verifyRes.data.item_ids.length > 0) {
                const itemId = verifyRes.data.item_ids[index - 1]
                retryRes = await publicItemsApi.get(itemId, verifyRes.data.session_token)
              } else {
                const seqNum = verifyRes.data.item_start + index - 1
                retryRes = await publicItemsApi.getBySeq(
                  verifyRes.data.dataset_id,
                  seqNum,
                  verifyRes.data.session_token,
                )
              }

              setCurrentItem(retryRes.data)
              setCurrentIndex(index)
              setEditingContent(JSON.parse(JSON.stringify(retryRes.data.current_content)))
              setEditingField(null)
              setLoading(false)
              return
            } else {
              message.error(verifyRes.data.message || '授权验证失败')
            }
          } catch (e: any) {
            console.error('[AuthReviewPage] re-verify failed', e)
            ;(window as any).__revdata_debug_logs.push({
              tag: 'AuthReviewPage',
              t: Date.now(),
              type: 'reverify_error',
              err: e?.response?.data || e?.message || String(e),
            })
          }
        }

        message.error(detail)
      } finally {
        setLoading(false)
      }
    },
    [session, code],
  )

  useEffect(() => {
    if (session) {
      fetchItem(1)
    }
  }, [session, fetchItem])

  // 导航
  const goPrev = () => {
    if (currentIndex > 1) fetchItem(currentIndex - 1)
  }

  const goNext = () => {
    if (currentIndex < totalItems) {
      fetchItem(currentIndex + 1)
    } else {
      setIsCompleted(true)
    }
  }

  // 开始编辑
  const startEdit = (field: string) => {
    if (session?.permission === 'view') {
      message.warning('当前授权仅允许查看，不可编辑')
      return
    }
    setEditingField(field)
    setEditingContent(JSON.parse(JSON.stringify(currentItem.current_content)))
  }

  // 保存
  const handleSave = async () => {
    if (!currentItem || !session) return
    setSaving(true)
    try {
      await publicItemsApi.update(
        currentItem.id,
        { current_content: editingContent },
        session.session_token,
      )

      // 记录授权审核
      if (code) {
        await authCodeApi
          .recordReview(code, {
            item_id: currentItem.id,
            action: 'edit',
            session_token: session.session_token,
          })
          .catch(() => {}) // 忽略记录失败
      }

      message.success('保存成功')
      setEditingField(null)
      fetchItem(currentIndex)
    } catch (err: any) {
      console.error('[AuthReviewPage] handleSave error', err)
      // 如果是认证失败，尝试重新验证一次授权码并重试一次保存
      const status = err?.response?.status
      if ((status === 401 || status === 403) && code) {
        try {
          const verifyRes = await authCodeApi.verify(code)
          if (verifyRes.data.valid) {
            setSession(verifyRes.data)
            sessionRef.current = verifyRes.data
            sessionStorage.setItem(`auth_session_${code}`, JSON.stringify(verifyRes.data))
            // 重试保存一次
            await publicItemsApi.update(
              currentItem.id,
              { current_content: editingContent },
              verifyRes.data.session_token,
            )
            if (code) {
              await authCodeApi
                .recordReview(code, {
                  item_id: currentItem.id,
                  action: 'edit',
                  session_token: verifyRes.data.session_token,
                })
                .catch(() => {})
            }
            message.success('保存成功（已重试）')
            setEditingField(null)
            fetchItem(currentIndex)
            return
          } else {
            message.error(verifyRes.data.message || '授权验证失败')
          }
        } catch (e) {
          console.error('[AuthReviewPage] re-verify on save failed', e)
        }
      }
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 取消编辑
  const handleCancel = () => {
    setEditingField(null)
    setEditingContent(currentItem?.current_content)
  }

  // 通过/拒绝
  const handleApprove = async () => {
    if (!currentItem || session?.permission === 'view') return
    setSaving(true)
    try {
      await publicItemsApi.approve(currentItem.id, session?.session_token)
      if (code) {
        await authCodeApi
          .recordReview(code, {
            item_id: currentItem.id,
            action: 'approve',
            session_token: session?.session_token,
          })
          .catch(() => {})
      }
      message.success('已通过')
      goNext()
    } catch (err: any) {
      console.error('[AuthReviewPage] handleApprove error', err)
      const status = err?.response?.status
      if ((status === 401 || status === 403) && code) {
        try {
          const verifyRes = await authCodeApi.verify(code)
          if (verifyRes.data.valid) {
            setSession(verifyRes.data)
            sessionRef.current = verifyRes.data
            sessionStorage.setItem(`auth_session_${code}`, JSON.stringify(verifyRes.data))

            // Retry
            await publicItemsApi.approve(currentItem.id, verifyRes.data.session_token)
            if (code) {
              await authCodeApi
                .recordReview(code, {
                  item_id: currentItem.id,
                  action: 'approve',
                  session_token: verifyRes.data.session_token,
                })
                .catch(() => {})
            }
            message.success('已通过')
            goNext()
            return
          }
        } catch (e) {
          console.error('[AuthReviewPage] re-verify failed', e)
        }
      }
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async () => {
    if (!currentItem || session?.permission === 'view') return
    setSaving(true)
    try {
      await publicItemsApi.reject(currentItem.id, session?.session_token)
      if (code) {
        await authCodeApi
          .recordReview(code, {
            item_id: currentItem.id,
            action: 'reject',
            session_token: session?.session_token,
          })
          .catch(() => {})
      }
      message.success('已拒绝')
      goNext()
    } catch (err: any) {
      console.error('[AuthReviewPage] handleReject error', err)
      const status = err?.response?.status
      if ((status === 401 || status === 403) && code) {
        try {
          const verifyRes = await authCodeApi.verify(code)
          if (verifyRes.data.valid) {
            setSession(verifyRes.data)
            sessionRef.current = verifyRes.data
            sessionStorage.setItem(`auth_session_${code}`, JSON.stringify(verifyRes.data))

            // Retry
            await publicItemsApi.reject(currentItem.id, verifyRes.data.session_token)
            if (code) {
              await authCodeApi
                .recordReview(code, {
                  item_id: currentItem.id,
                  action: 'reject',
                  session_token: verifyRes.data.session_token,
                })
                .catch(() => {})
            }
            message.success('已拒绝')
            goNext()
            return
          }
        } catch (e) {
          console.error('[AuthReviewPage] re-verify failed', e)
        }
      }
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  // 退出
  const handleExit = async () => {
    if (session?.session_token) {
      await authCodeApi.leave(session.session_token).catch(() => {})
      sessionStorage.removeItem(`auth_session_${code}`)
    }
    navigate('/auth')
  }

  // 快捷键
  useHotkeys(hotkeys.prevItem, goPrev, { enabled: !editingField })
  useHotkeys(hotkeys.nextItem, goNext, { enabled: !editingField })
  useHotkeys(hotkeys.approve, handleApprove, {
    enabled: !editingField && session?.permission !== 'view',
    preventDefault: true,
  })
  useHotkeys(hotkeys.reject, handleReject, {
    enabled: !editingField && session?.permission !== 'view',
    preventDefault: true,
  })
  useHotkeys(hotkeys.focusQ, () => startEdit('q_0'), {
    enabled: !editingField,
    preventDefault: true,
  })
  useHotkeys(hotkeys.focusA, () => startEdit('a_0'), {
    enabled: !editingField,
    preventDefault: true,
  })
  useHotkeys(hotkeys.save, handleSave, {
    enabled: !!editingField,
    preventDefault: true,
  })
  useHotkeys(hotkeys.cancel, handleCancel, { enabled: !!editingField })

  // 主题配置
  const themeConfig = isDark
    ? { algorithm: theme.darkAlgorithm, token: { colorPrimary: '#1890ff' } }
    : { algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#1890ff' } }

  // 错误状态
  if (error) {
    return (
      <ConfigProvider theme={themeConfig}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDark ? '#141414' : '#f5f5f5',
          }}
        >
          <Result
            status="error"
            title="授权验证失败"
            subTitle={error}
            extra={[
              <Button key="retry" onClick={() => navigate('/auth')}>
                重新输入授权码
              </Button>,
            ]}
          />
        </div>
      </ConfigProvider>
    )
  }

  // 完成状态
  if (isCompleted) {
    return (
      <ConfigProvider theme={themeConfig}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDark ? '#141414' : '#f5f5f5',
          }}
        >
          <Result
            status="success"
            title="审核任务已完成"
            subTitle="感谢您的辛勤工作！您已完成所有分配的语料审核。"
            extra={[
              <Button type="primary" key="exit" onClick={handleExit}>
                退出任务
              </Button>,
              <Button
                key="review"
                onClick={() => {
                  setIsCompleted(false)
                  fetchItem(1)
                }}
              >
                重新检查
              </Button>,
            ]}
          />
        </div>
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider theme={themeConfig}>
      <div
        style={{
          minHeight: '100vh',
          background: isDark ? '#141414' : '#f5f5f5',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 顶部栏 */}
        <div
          style={{
            height: 56,
            background: isDark ? '#1f1f1f' : '#fff',
            borderBottom: isDark ? '1px solid #434343' : '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
          }}
        >
          <Space>
            <Button type="text" icon={<CloseOutlined />} onClick={handleExit} />
            <Title level={5} style={{ margin: 0, color: isDark ? '#e8e8e8' : '#333' }}>
              授权审核
            </Title>
            <Text type="secondary">授权码: {code}</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {currentIndex} / {totalItems}
            </Text>
            {session?.permission === 'view' && (
              <Text type="warning" style={{ marginLeft: 8 }}>
                （仅查看）
              </Text>
            )}
          </Space>

          <Space>
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
            />
            <Button type="text" icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)} />
          </Space>
        </div>

        {/* 内容区域 */}
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          <Spin spinning={loading}>
            {currentItem && (
              <QACardUnified
                originalContent={currentItem.original_content}
                currentContent={editingField ? editingContent : currentItem.current_content}
                seqNum={currentItem.seq_num}
                theme={appTheme}
                editingField={editingField}
                onStartEdit={startEdit}
                onContentChange={setEditingContent}
                onSave={handleSave}
                onCancel={handleCancel}
                readOnly={session?.permission === 'view'}
              />
            )}
          </Spin>
        </div>

        {/* 底部操作栏 */}
        <div
          style={{
            height: 64,
            background: isDark ? '#1f1f1f' : '#fff',
            borderTop: isDark ? '1px solid #434343' : '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
          }}
        >
          {/* 左侧：导航 */}
          <Space>
            <Button
              icon={<LeftOutlined />}
              onClick={goPrev}
              disabled={currentIndex <= 1 || !!editingField}
            >
              上一条
            </Button>
            <Text style={{ margin: '0 12px', color: isDark ? '#e8e8e8' : '#333' }}>
              <strong>{currentIndex}</strong> / {totalItems}
            </Text>
            <Button
              icon={<RightOutlined />}
              onClick={goNext}
              disabled={currentIndex >= totalItems || !!editingField}
            >
              下一条
            </Button>
          </Space>

          {/* 右侧：操作按钮 */}
          {session?.permission !== 'view' && (
            <Space>
              <Button
                type="primary"
                danger
                onClick={handleReject}
                disabled={!!editingField}
                loading={saving}
              >
                拒绝 (Ctrl+Shift+Enter)
              </Button>
              <Button
                type="primary"
                onClick={handleApprove}
                disabled={!!editingField}
                loading={saving}
              >
                通过 (Ctrl+Enter)
              </Button>
            </Space>
          )}
        </div>

        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </ConfigProvider>
  )
}
