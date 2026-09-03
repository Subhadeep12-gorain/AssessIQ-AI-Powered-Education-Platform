import { useState, useEffect } from 'react'
import '../../styles/Auth.css'
import NeuralBackground from '../../components/common/NeuralBackground'
import AuthLogo from '../../components/common/AuthLogo'
import CustomSelect from '../../components/common/CustomSelect'
import apiService from '../../services/apiService'



export default function Signup({ onGoLogin, onGoHome }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Student')
  const [grade, setGrade] = useState('')
  const [department, setDepartment] = useState('')
  const [customDept, setCustomDept] = useState('')
  const [childrenEmails, setChildrenEmails] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name || !email || !password) { setError('Please fill all fields.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (!email.toLowerCase().includes('@gmail.com')) { setError('Please enter a valid Gmail address (@gmail.com).'); return }
    if (role === 'Parent' && !childrenEmails) { setError('Please enter at least one child\'s email.'); return }

    let apiRole = 'student';
    if (role === 'Teacher') apiRole = 'teacher';
    else if (role === 'Admin') apiRole = 'admin';
    else if (role === 'Parent') apiRole = 'parent';

    try {
      await apiService.register({
        name,
        email,
        password,
        role: apiRole
      });
      setError('');
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onGoLogin(); }, 1500);
    } catch (err) {
      setError(err.message || 'Registration failed.');
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
          <h2>Start your journey<br />today.</h2>
          <p>Create an account in seconds and unlock the full potential of AI-driven assessments, personalized grading, and powerful analytics.</p>
        </div>

        <div className="auth-testimonial">
          <p>"The analytics dashboard is incredible. I can instantly see where my students are struggling and adjust my lesson plans accordingly."</p>
          <div className="auth-testimonial-author">
            <div className="auth-author-avatar" style={{ background: '#EC4899' }}>M</div>
            <div className="auth-author-info">
              <span className="auth-author-name">Mark Thompson</span>
              <span className="auth-author-role">Science Teacher</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL (Form + Neural BG) ── */}
      <div className="auth-right">
        <NeuralBackground />

        <div className="auth-form-wrapper">
            <div className="auth-card" style={{ margin: 'auto' }}>
              <h2>Get started</h2>
              {!success && <p className="auth-sub">Fill in your details to create an account</p>}

              <label className="auth-label">Full Name</label>
              <div className="auth-input-wrap">
                <span>👤</span>
                <input placeholder="Enter your full name" value={name} onChange={e => setName(e.target.value)} />
              </div>

              <label className="auth-label">Email</label>
              <div className="auth-input-wrap">
                <span>✉️</span>
                <input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <label className="auth-label">Password</label>
              <div className="auth-input-wrap">
                <span>🔒</span>
                <input type="password" placeholder="Create a password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>

              <label className="auth-label">Role</label>
              <CustomSelect
                value={role}
                icon="🎓"
                options={['Student', 'Teacher', 'Parent', 'Admin']}
                onChange={val => { setRole(val); setGrade(''); setDepartment(''); setCustomDept(''); setChildrenEmails('') }}
              />

              {role === 'Parent' && (
                <>
                  <label className="auth-label">Children Emails</label>
                  <div className="auth-input-wrap">
                    <span>✉️</span>
                    <input placeholder="Enter child emails (comma separated)" value={childrenEmails} onChange={e => setChildrenEmails(e.target.value)} />
                  </div>
                  <p style={{ fontSize: 9, color: '#64748B', marginTop: -8, marginBottom: 12, paddingLeft: 4 }}>Separated by commas (e.g., child1@edu.com, child2@edu.com)</p>
                </>
              )}


              {error && <p className="auth-error">{error}</p>}
              {success && <p className="auth-success">Account created! Redirecting to login...</p>}

              <button className="auth-btn-primary" onClick={handleSubmit}>Create account</button>
              <p className="auth-switch">Already have an account? <span onClick={onGoLogin}>Sign in</span></p>
            </div>
        </div>
      </div>
    </div>
  )
}