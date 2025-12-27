import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import DatasetsPage from './pages/DatasetsPage'
import LoginPage from './pages/LoginPage'
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

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/share/:token" element={<ShareAccessPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/datasets" replace />} />
        <Route path="datasets" element={<DatasetsPage />} />
        <Route path="datasets/:datasetId/review" element={<ReviewPageV2 />} />
        <Route path="tasks" element={<TasksPage />} />
      </Route>
    </Routes>
  )
}

export default App
