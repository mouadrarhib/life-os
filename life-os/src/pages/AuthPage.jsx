import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export function AuthPage() {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  if (user) {
    return <Navigate to="/" replace />
  }

  const submitLabel = mode === 'signin' ? 'Sign In' : 'Create Account'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrorMessage('')
    setSuccessMessage('')

    const action =
      mode === 'signin' ? signIn(email, password) : signUp(email, password, fullName.trim())

    const { error, data } = await action
    setBusy(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    if (mode === 'signup' && !data.session) {
      setSuccessMessage('Account created. Check your email to confirm your account.')
      return
    }

    setSuccessMessage('Success. Redirecting...')
  }

  return (
    <main className="auth-layout">
      <section className="panel">
        <p className="eyebrow">Life OS</p>
        <h1>Welcome back</h1>
        <p className="muted">Manage your goals, money, work, and fitness in one place.</p>

        <div className="mode-switch">
          <button
            type="button"
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => setMode('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          {mode === 'signup' ? (
            <label>
              Full name
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your name"
                required
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              minLength={6}
              required
            />
          </label>

          <button type="submit" disabled={busy} className="primary-btn">
            {busy ? 'Please wait...' : submitLabel}
          </button>
        </form>

        {errorMessage ? <p className="message error">{errorMessage}</p> : null}
        {successMessage ? <p className="message success">{successMessage}</p> : null}
      </section>
    </main>
  )
}
