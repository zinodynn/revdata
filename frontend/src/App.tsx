import { Navigate, Route, Routes } from 'react-router-dom'
import LayoutV2 from './components/LayoutV2'
import AuthCodePage from './pages/AuthCodePage'
import AuthReviewPage from './pages/AuthReviewPage'
import DatasetDetailPage from './pages/DatasetDetailPage'
import DatasetsPage from './pages/DatasetsPage'
import LoginPage from './pages/LoginPage'
import MembersPage from './pages/MembersPage'
import PureReviewPage from './pages/PureReviewPage'
import ReviewPageV2 from './pages/ReviewPageV2'
import ShareAccessPage from './pages/ShareAccessPage'
import TasksPage from './pages/TasksPage'
import { useAuthStore } from './stores/authStore'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

// 管理员路由保护
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return <Navigate to="/tasks" replace />
  }
  
  return <>{children}</>
}

function App() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  
  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/share/:token" element={<ShareAccessPage />} />
      <Route path="/auth/:code?" element={<AuthCodePage />} />
      <Route path="/auth-review/:code" element={<AuthReviewPage />} />
      
      {/* 主布局 */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <LayoutV2 />
          </PrivateRoute>
        }
      >
        {/* 根据角色重定向 */}
        <Route index element={<Navigate to={isAdmin ? '/datasets' : '/tasks'} replace />} />
        
        {/* 管理员路由 */}
        <Route path="datasets" element={<AdminRoute><DatasetsPage /></AdminRoute>} />
        <Route path="datasets/:id" element={<AdminRoute><DatasetDetailPage /></AdminRoute>} />
        <Route path="members" element={<AdminRoute><MembersPage /></AdminRoute>} />
        
        {/* 共享路由 */}
        <Route path="tasks" element={<TasksPage />} />
      </Route>
      
      {/* 纯净审核页面（无侧边栏） */}
      <Route
        path="/review/:datasetId"
        element={
          <PrivateRoute>
            <PureReviewPage />
          </PrivateRoute>
        }
      />
      
      {/* 兼容旧路由 */}
      <Route
        path="/datasets/:datasetId/review"
        element={
          <PrivateRoute>
            <ReviewPageV2 />
          </PrivateRoute>
        }
      />
    </Routes>
  )
}

export default App
