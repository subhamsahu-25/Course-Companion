import { useState } from 'react'
import { login as apiLogin, register as apiRegister } from '../api/client.js'

const registerRoles = [
  { id: 'student', title: 'Student' },
  { id: 'instructor', title: 'Instructor' },
  { id: 'ta', title: 'Teaching Assistant' },
]

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')

  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        const res = await apiLogin(email, password)
        onLogin(res.data.user)
      } else {
        await apiRegister({ email, username, password, role })
        // registration doesn't log the user in automatically on the backend
        // (no tokens are issued at signup), so send them to log in next.
        const res = await apiLogin(email, password)
        onLogin(res.data.user)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4 py-8 sm:px-6">

      <div className="w-full max-w-142.5">

        <div className="mb-8 text-center sm:mb-10 sm:text-left">

          <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[#457B9D] sm:text-sm">
            Academic Portal
          </div>

          <h1 className="font-serif text-[38px] leading-[1.05] text-[#1D3557] sm:text-[48px] md:text-[56px]">
            Course Companion
            <br />
            Portal
          </h1>

          <p className="mx-auto mt-4 max-w-125 text-[15px] leading-6 text-[#457B9D] sm:mx-0 sm:text-[17px]">
            A simple place to browse course material,
            ask questions, and review answers.
          </p>

        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-[#D5DEE5] bg-white px-4 py-6 shadow-sm sm:px-6 sm:py-7"
        >
          <div className="flex gap-2 rounded-lg bg-[#F3F7F9] p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-md py-2 text-[14px] font-medium transition ${
                mode === 'login' ? 'bg-white text-[#1D3557] shadow-sm' : 'text-[#647D8D]'
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded-md py-2 text-[14px] font-medium transition ${
                mode === 'register' ? 'bg-white text-[#1D3557] shadow-sm' : 'text-[#647D8D]'
              }`}
            >
              Sign up
            </button>
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#457B9D]">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[#D5DEE5] px-3 py-2 text-[15px] text-[#2B2D42] outline-none focus:border-[#457B9D]"
              placeholder="you@example.com"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#457B9D]">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full rounded-md border border-[#D5DEE5] px-3 py-2 text-[15px] text-[#2B2D42] outline-none focus:border-[#457B9D]"
                placeholder="lowercase, 3-20 characters"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#457B9D]">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[#D5DEE5] px-3 py-2 text-[15px] text-[#2B2D42] outline-none focus:border-[#457B9D]"
              placeholder="••••••••"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#457B9D]">I am a...</label>
              <div className="grid grid-cols-3 gap-2">
                {registerRoles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`rounded-md border px-2 py-2 text-[13px] transition ${
                      role === r.id
                        ? 'border-[#457B9D] bg-[#E7F0F5] font-medium text-[#1D3557]'
                        : 'border-[#D5DEE5] text-[#647D8D] hover:border-[#457B9D]'
                    }`}
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-[#1D3557] px-4 py-2.5 text-[15px] font-medium text-white transition hover:bg-[#16294a] disabled:opacity-60"
          >
            {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

      </div>

    </div>
  )
}
