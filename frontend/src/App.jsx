import { useState } from 'react'

import Login from './pages/Login.jsx'
import RoleLayout from './layouts/RoleLayout.jsx'

import StudentDashboard from './pages/student/Dashboard.jsx'
import StudentModules from './pages/student/Modules.jsx'
import StudentAsk from './pages/student/Ask.jsx'

import ReviewQueue from './pages/ta/ReviewQueue.jsx'

import AdminModules from './pages/admin/Modules.jsx'
import AdminUpload from './pages/admin/Upload.jsx'

export default function App() {
  const [role, setRole] = useState('')
  const [currentPage, setCurrentPage] = useState('login')

  function login(selectedRole) {
    setRole(selectedRole)

    if (selectedRole === 'student') {
      setCurrentPage('student-dashboard')
    }

    if (selectedRole === 'ta') {
      setCurrentPage('ta-review')
    }

    if (selectedRole === 'admin') {
      setCurrentPage('admin-modules')
    }
  }

  function logout() {
    setRole('')
    setCurrentPage('login')
  }

  function changePage(page) {
    setCurrentPage(page)
  }

  function getPage() {
    if (currentPage === 'student-dashboard') {
      return (
        <StudentDashboard
          onPageChange={changePage}
        />
      )
    }

    if (currentPage === 'student-modules') {
      return (
        <StudentModules
          onPageChange={changePage}
        />
      )
    }

    if (currentPage === 'student-ask') {
      return <StudentAsk />
    }

    if (currentPage === 'ta-review') {
      return <ReviewQueue />
    }

    if (currentPage === 'admin-modules') {
      return (
        <AdminModules
          onPageChange={changePage}
        />
      )
    }

    if (currentPage === 'admin-upload') {
      return <AdminUpload />
    }

    return (
      <div className="rounded-lg bg-white p-6">
        Page not found
      </div>
    )
  }

  if (currentPage === 'login') {
    return <Login onLogin={login} />
  }

  return (
    <RoleLayout
      role={role}
      currentPage={currentPage}
      onPageChange={changePage}
      onLogout={logout}
    >
      {getPage()}
    </RoleLayout>
  )
}