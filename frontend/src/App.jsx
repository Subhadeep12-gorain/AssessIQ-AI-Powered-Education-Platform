import { useState } from 'react'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import StudentDashboard from './pages/student/StudentDashboard'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'
import ParentDashboard from './pages/parent/ParentDashboard'
import LandingPage from './pages/Landing/LandingPage'
import apiService from './services/apiService'

function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem('current_user')
      return savedUserStr ? JSON.parse(savedUserStr) : null
    } catch (e) {
      console.error("Failed to parse user from local storage:", e)
      localStorage.removeItem('current_user')
      return null
    }
  })

  const [page, setPage] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem('current_user')
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr)
        if (savedUser) {
          return savedUser.role?.toLowerCase() === 'student' ? 'student-dashboard' :
            (savedUser.role?.toLowerCase() === 'teacher' ? 'teacher-dashboard' :
              (savedUser.role?.toLowerCase() === 'admin' ? 'admin-dashboard' :
                (savedUser.role?.toLowerCase() === 'parent' ? 'parent-dashboard' : 'landing')))
        }
      }
    } catch {
      // error handled in user state init
    }
    return 'landing'
  })

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser)
    localStorage.setItem('current_user', JSON.stringify(loggedInUser))
    setPage(
      loggedInUser.role?.toLowerCase() === 'student' ? 'student-dashboard' :
        (loggedInUser.role?.toLowerCase() === 'teacher' ? 'teacher-dashboard' :
          (loggedInUser.role?.toLowerCase() === 'admin' ? 'admin-dashboard' :
            (loggedInUser.role?.toLowerCase() === 'parent' ? 'parent-dashboard' : 'landing')))
    )
  }

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser)
    localStorage.setItem('current_user', JSON.stringify(updatedUser))
  }

  const handleLogout = async () => {
    await apiService.logout()
    setUser(null)
    localStorage.removeItem('current_user')
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('assessiq_users')
    localStorage.removeItem('sidebar_scrolled')
    localStorage.removeItem('classes')
    localStorage.removeItem('assessments')
    localStorage.removeItem('submissions')
    localStorage.removeItem('student_mock_submissions')
    localStorage.removeItem('student_mock_assessments')
    setPage('landing')
  }


  return (
    <div>
      {page === 'landing' && <LandingPage onGoLogin={() => setPage('login')} onGoSignup={() => setPage('signup')} />}
      {page === 'login' && <Login onGoHome={() => setPage('landing')} onGoSignup={() => setPage('signup')} onLogin={handleLogin} />}
      {page === 'signup' && <Signup onGoHome={() => setPage('landing')} onGoLogin={() => setPage('login')} />}
      {page === 'student-dashboard' && user && <StudentDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />}
      {page === 'teacher-dashboard' && user && <TeacherDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />}
      {page === 'admin-dashboard' && user && <AdminDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />}
      {page === 'parent-dashboard' && user && <ParentDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />}
    </div>
  )
}

export default App