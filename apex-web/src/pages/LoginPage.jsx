import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail, User, ArrowLeft, CheckCircle } from 'lucide-react'

function Input({ icon: Icon, type = 'text', value, onChange, placeholder, required, autoFocus, rightEl }) {
  return (
    <div className="relative">
      <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none" />
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className="w-full bg-bg border border-border/50 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder:text-muted/40 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 transition-all"
      />
      {rightEl && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</div>
      )}
    </div>
  )
}

function FieldGroup({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login')  // 'login' | 'signup' | 'done'
  const [showPw, setShowPw]   = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [doneMsg, setDoneMsg] = useState('')

  const [loginForm, setLoginForm]   = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '', confirm: '' })

  function updateLogin(k, v) { setLoginForm(f => ({ ...f, [k]: v })); setError('') }
  function updateSignup(k, v) { setSignupForm(f => ({ ...f, [k]: v })); setError('') }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginForm.email, password: loginForm.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Sign in failed')
      } else {
        localStorage.setItem('apex_token', data.token)
        onLogin(data.token)
      }
    } catch {
      setError('Connection error — please try again.')
    }
    setLoading(false)
  }

  async function handleSignup(e) {
    e.preventDefault()
    if (signupForm.password !== signupForm.confirm) {
      return setError('Passwords do not match.')
    }
    if (signupForm.password.length < 6) {
      return setError('Password must be at least 6 characters.')
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: signupForm.name, email: signupForm.email, password: signupForm.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Signup failed.')
      } else {
        setDoneMsg(`Your request has been submitted! The admin will review your access and you'll receive an email at ${signupForm.email} once approved.`)
        setMode('done')
      }
    } catch {
      setError('Connection error — please try again.')
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(10,132,255,0.08) 0%, transparent 60%), #000' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #0a84ff 0%, #bf5af2 100%)' }}
          >
            <span className="text-white text-2xl font-bold tracking-tighter">A</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">ATI</h1>
          <p className="text-muted text-sm mt-1">Market Intelligence · Private Access</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-border/50 p-7"
          style={{ background: 'rgba(28,28,30,0.9)', backdropFilter: 'blur(24px)' }}
        >
          {/* ── Done state ── */}
          {mode === 'done' && (
            <div className="text-center py-2">
              <CheckCircle size={44} className="text-bull mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-3">Request Submitted!</h2>
              <p className="text-muted text-sm leading-relaxed mb-6">{doneMsg}</p>
              <button
                onClick={() => { setMode('login'); setSignupForm({ name: '', email: '', password: '', confirm: '' }) }}
                className="text-accent text-sm hover:underline flex items-center gap-1.5 mx-auto"
              >
                <ArrowLeft size={13} /> Back to Sign In
              </button>
            </div>
          )}

          {/* ── Login form ── */}
          {mode === 'login' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">Sign In</h2>
                  <p className="text-muted text-xs mt-0.5">Use your email and password</p>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <FieldGroup label="Email">
                  <Input
                    icon={Mail}
                    type="email"
                    value={loginForm.email}
                    onChange={e => updateLogin('email', e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                  />
                </FieldGroup>

                <FieldGroup label="Password">
                  <Input
                    icon={Lock}
                    type={showPw ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={e => updateLogin('password', e.target.value)}
                    placeholder="Your password"
                    required
                    rightEl={
                      <button type="button" onClick={() => setShowPw(v => !v)} className="text-muted/60 hover:text-muted transition-colors">
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    }
                  />
                </FieldGroup>

                {error && (
                  <div className="text-bear text-sm bg-bear/10 border border-bear/20 px-4 py-2.5 rounded-xl">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !loginForm.email || !loginForm.password}
                  className="w-full font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-40 text-white"
                  style={{ background: 'linear-gradient(135deg, #0a84ff, #0070e0)' }}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-border/30 text-center">
                <p className="text-muted text-sm">
                  Don't have access?{' '}
                  <button
                    onClick={() => { setMode('signup'); setError('') }}
                    className="text-accent hover:underline font-medium"
                  >
                    Request Access
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ── Signup form ── */}
          {mode === 'signup' && (
            <>
              <div className="mb-6">
                <button
                  onClick={() => { setMode('login'); setError('') }}
                  className="flex items-center gap-1.5 text-muted hover:text-white text-xs mb-4 transition-colors"
                >
                  <ArrowLeft size={13} /> Back to Sign In
                </button>
                <h2 className="text-lg font-semibold text-white">Request Access</h2>
                <p className="text-muted text-xs mt-0.5">The admin will review and approve your request</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <FieldGroup label="Full Name">
                  <Input
                    icon={User}
                    value={signupForm.name}
                    onChange={e => updateSignup('name', e.target.value)}
                    placeholder="Your full name"
                    required
                    autoFocus
                  />
                </FieldGroup>

                <FieldGroup label="Email">
                  <Input
                    icon={Mail}
                    type="email"
                    value={signupForm.email}
                    onChange={e => updateSignup('email', e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </FieldGroup>

                <FieldGroup label="Password">
                  <Input
                    icon={Lock}
                    type={showPw ? 'text' : 'password'}
                    value={signupForm.password}
                    onChange={e => updateSignup('password', e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    rightEl={
                      <button type="button" onClick={() => setShowPw(v => !v)} className="text-muted/60 hover:text-muted transition-colors">
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    }
                  />
                </FieldGroup>

                <FieldGroup label="Confirm Password">
                  <Input
                    icon={Lock}
                    type={showPw2 ? 'text' : 'password'}
                    value={signupForm.confirm}
                    onChange={e => updateSignup('confirm', e.target.value)}
                    placeholder="Repeat your password"
                    required
                    rightEl={
                      <button type="button" onClick={() => setShowPw2(v => !v)} className="text-muted/60 hover:text-muted transition-colors">
                        {showPw2 ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    }
                  />
                </FieldGroup>

                {error && (
                  <div className="text-bear text-sm bg-bear/10 border border-bear/20 px-4 py-2.5 rounded-xl">
                    {error}
                  </div>
                )}

                <div className="bg-bg border border-border/30 rounded-xl px-4 py-3 text-xs text-muted leading-relaxed">
                  🔐 Your request will be sent to the admin for approval. You'll receive an email once access is granted.
                </div>

                <button
                  type="submit"
                  disabled={loading || !signupForm.name || !signupForm.email || !signupForm.password || !signupForm.confirm}
                  className="w-full font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-40 text-white"
                  style={{ background: 'linear-gradient(135deg, #30d158, #25a244)' }}
                >
                  {loading ? 'Submitting request…' : 'Submit Access Request'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted/30 mt-5">
          ATI · Advanced Trade Intelligence Platform
        </p>
      </div>
    </div>
  )
}
