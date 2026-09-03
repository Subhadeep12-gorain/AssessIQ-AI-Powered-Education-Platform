import { useState } from 'react'
import '../../styles/Auth.css'
import NeuralBackground from '../../components/common/NeuralBackground'
import AuthLogo from '../../components/common/AuthLogo'
import apiService from '../../services/apiService'

export default function Login({ onGoSignup, onLogin, onGoHome }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [view, setView] = useState('login') // 'login', 'forgot', 'reset'
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter email and password.'); return }
    setLoading(true)
    try {
      const data = await apiService.login(email, password)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)

      const user = data.user;

      // Merge any missing fields (name, childrenEmails) from local user record

      // Block suspended users from logging in
      if (user.status === 'suspended') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setError('⚠️ Your account has been suspended. Please contact the administrator.');
        setLoading(false);
        return;
      }

      onLogin(user)
      setError('')
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) { setError('Please enter your email.'); return }
    setLoading(true)
    try {
      await apiService.auth.forgotPassword(email);
      setError('');
      setSuccessMsg('Reset code sent to your email.');
      setView('reset');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to send reset code.');
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetCode || !newPassword) { setError('Please enter code and new password.'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    try {
      await apiService.auth.resetPassword(resetCode, newPassword);
      setError('');
      setSuccessMsg('Password reset successfully! You can now login.');
      setView('login');
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">

      {/* ── LEFT PANEL (Branding) ── */}
      <div className="auth-left">
        <div className="auth-brand-header" onClick={onGoHome}>
          <AuthLogo />
          <h1 style={{ color: 'white' }}>AssessIQ</h1>
        </div>

        <div className="auth-left-content">
          <h2>Smarter learning,<br />better outcomes.</h2>
          <p>Join thousands of students and teachers who are using AssessIQ to transform their educational experience with AI-powered insights.</p>
        </div>

        <div className="auth-testimonial">
          <p>"AssessIQ completely changed how I study for my exams. The AI generated quizzes are exactly what I needed to boost my grades."</p>
          <div className="auth-testimonial-author">
            <div className="auth-author-avatar">S</div>
            <div className="auth-author-info">
              <span className="auth-author-name">Sarah Jenkins</span>
              <span className="auth-author-role">High School Senior</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL (Form + Neural BG) ── */}
      <div className="auth-right">
        {/* Neural Network acts as the background for the right panel only */}
        <NeuralBackground />

        <div className="auth-form-wrapper">
          {view === 'login' && (
            <div className="auth-card">
              <h2>Welcome back</h2>
              <p className="auth-sub">Enter your credentials to access your dashboard</p>

              {successMsg && <div className="auth-success" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '8px', marginBottom: '16px' }}>{successMsg}</div>}

              <label className="auth-label">Email</label>
              <div className="auth-input-wrap">
                <span>✉️</span>
                <input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="auth-label" style={{ marginBottom: 0 }}>Password</label>
                <span onClick={() => { setView('forgot'); setError(''); setSuccessMsg(''); }} style={{ fontSize: 12, color: 'var(--lumina-teal)', cursor: 'pointer', fontWeight: 600 }}>Forgot Password?</span>
              </div>
              <div className="auth-input-wrap" style={{ marginTop: 8 }}>
                <span>🔒</span>
                <input type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button className="auth-btn-primary" onClick={handleLogin} disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
              <p className="auth-switch">Don't have an account? <span onClick={onGoSignup}>Sign up</span></p>

            </div>
          )}

          {view === 'forgot' && (
            <div className="auth-card" style={{ textAlign: 'center' }}>
              <h2>Reset Password</h2>
              <p className="auth-sub">Enter your email to receive a reset code</p>

              <div className="auth-input-wrap" style={{ marginTop: 24, textAlign: 'left' }}>
                <span>✉️</span>
                <input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button className="auth-btn-primary" onClick={handleForgotPassword} disabled={loading} style={{ marginTop: 24 }}>
                {loading ? 'SENDING...' : 'SEND RESET CODE'}
              </button>
              <p className="auth-switch"><span onClick={() => { setView('login'); setError(''); }}>Back to Login</span></p>
            </div>
          )}

          {view === 'reset' && (
            <div className="auth-card" style={{ textAlign: 'center' }}>
              <h2>Enter Reset Code</h2>
              <p className="auth-sub">We sent a 6-digit code to {email}</p>

              {successMsg && <div className="auth-success" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '8px', marginBottom: '16px' }}>{successMsg}</div>}

              <div className="auth-input-group" style={{ marginTop: '24px' }}>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="6-digit code"
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value)}
                  maxLength={6}
                  style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '20px', fontWeight: 'bold' }}
                />
              </div>

              <div className="auth-input-wrap" style={{ marginTop: 16, textAlign: 'left' }}>
                <span>🔒</span>
                <input type="password" placeholder="New password (min 6 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button className="auth-btn-primary" onClick={handleResetPassword} disabled={loading} style={{ marginTop: 24 }}>
                {loading ? 'RESETTING...' : 'CONFIRM RESET'}
              </button>
              <p className="auth-switch"><span onClick={() => { setView('login'); setError(''); }}>Back to Login</span></p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}