import { useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Bike, Check, Eye, EyeOff, KeyRound, LockKeyhole,
  Mail, MapPin, PackageCheck, ShieldCheck, UserRound, Zap,
} from 'lucide-react'
import { demoRequest } from './demo-auth.js'
import './auth.css'

async function postJson(path, data, demoMode) {
  if (demoMode) return demoRequest(path, data)
  let response
  try {
    response = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  } catch {
    throw new Error('Cannot reach the QuickHatid API. Start the frontend and API together with `npm run dev`, then try again.')
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const requestError = new Error(result.error || 'The request could not be completed.')
    requestError.fields = result.fields || {}
    throw requestError
  }
  return result
}

function PasswordInput({ label, value, onChange, autoComplete, name, placeholder = 'Enter your password' }) {
  const [visible, setVisible] = useState(false)
  return (
    <label className="auth-field">
      <span>{label}</span>
      <span className="auth-input-wrap">
        <LockKeyhole size={16} />
        <input name={name} type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} placeholder={placeholder} required />
        <button type="button" className="password-toggle" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
      </span>
    </label>
  )
}

function AuthPage({ onAuthenticated, serviceError = '', successNotice = '', demoMode = true }) {
  const [screen, setScreen] = useState('signin')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [remember, setRemember] = useState(true)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryStep, setRecoveryStep] = useState('email')
  const [resetCode, setResetCode] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [demoCode, setDemoCode] = useState('')
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (recoveryStep !== 'code' || secondsLeft <= 0) return undefined
    const timer = window.setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [recoveryStep, secondsLeft])

  function changeScreen(next) {
    setScreen(next)
    setMessage('')
    setFieldErrors({})
    setFormKey((key) => key + 1)
  }

  async function submit(event, action) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setFieldErrors({})
    try {
      await action()
    } catch (error) {
      setMessage(error.message)
      setFieldErrors(error.fields || {})
    } finally {
      setBusy(false)
    }
  }

  function handleLogin(event) {
    const form = new FormData(event.currentTarget)
    return submit(event, async () => {
      const result = await postJson('/api/auth/login', {
        identifier: form.get('identifier'),
        password: form.get('password'),
        remember,
      }, demoMode)
      onAuthenticated(result.user, result.message)
    })
  }

  function handleRegister(event) {
    const form = new FormData(event.currentTarget)
    return submit(event, async () => {
      const result = await postJson('/api/auth/register', {
        fullName: form.get('fullName'),
        username: form.get('username'),
        email: form.get('email'),
        mobileNumber: form.get('mobileNumber'),
        password: form.get('password'),
        confirmPassword: form.get('confirmPassword'),
      }, demoMode)
      onAuthenticated(result.user, result.message)
    })
  }

  function requestCode(event) {
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim().toLowerCase()
    return submit(event, async () => {
      const result = await postJson('/api/auth/forgot-password', { email }, demoMode)
      setRecoveryEmail(email)
      setRecoveryStep('code')
      setSecondsLeft(60)
      setDemoCode(result.demoCode || '')
      setMessage(demoMode
        ? 'Exhibition mode: verification stays on this device and expires in 5 minutes.'
        : 'If that email belongs to an active account, a verification code is on its way. The code expires in 5 minutes.')
    })
  }

  function resendCode(event) {
    return submit(event, async () => {
      const result = await postJson('/api/auth/forgot-password', { email: recoveryEmail }, demoMode)
      setSecondsLeft(60)
      setDemoCode(result.demoCode || '')
      setMessage(demoMode ? 'A new exhibition verification code was created.' : 'If that email belongs to an active account, a new code is on its way.')
    })
  }

  function verifyCode(event) {
    const form = new FormData(event.currentTarget)
    const code = String(form.get('code') || '').trim()
    return submit(event, async () => {
      await postJson('/api/auth/verify-reset-code', { email: recoveryEmail, code }, demoMode)
      setResetCode(code)
      setRecoveryStep('reset')
      setMessage('')
    })
  }

  function resetPassword(event) {
    const form = new FormData(event.currentTarget)
    return submit(event, async () => {
      await postJson('/api/auth/reset-password', {
        email: recoveryEmail,
        code: resetCode,
        password: form.get('password'),
        confirmPassword: form.get('confirmPassword'),
      }, demoMode)
      setRecoveryStep('success')
      setMessage('')
    })
  }

  const isRecovery = screen === 'forgot'
  const title = screen === 'signin' ? 'Welcome back' : screen === 'signup' ? 'Join your community' : 'Reset your password'
  const subtitle = screen === 'signin'
    ? 'Your next ride or errand is just around the corner.'
    : screen === 'signup' ? 'Create an account and let’s make everyday easier.'
      : 'We’ll help you get back to your QuickHatid account.'

  return (
    <main className="auth-screen">
      <div className="auth-decoration auth-decoration-one" /><div className="auth-decoration auth-decoration-two" />
      <div className="auth-topline">
        <a className="auth-brand" href="/" aria-label="QuickHatid home"><span><Zap size={20} fill="currentColor" /></span>quick<span>hatid</span></a>
        <div><MapPin size={14} /> Don Carlos, Bukidnon</div>
      </div>
      <div className={`auth-layout ${screen === 'signup' ? 'auth-layout-signup' : ''}`}>
        <section className="auth-promo">
          <div className="auth-promo-tag"><span /> YOUR LOCAL SERVICE, ON THE WAY</div>
          <h1>Good things<br />are <span>closer</span> than<br />you think.</h1>
          <p>Rides, errands, and helpful neighbors — all in one place. Let’s get you where you need to be.</p>
          <div className="auth-promo-illustration" aria-hidden="true">
            <div className="auth-promo-orbit" /><div className="auth-promo-pin"><MapPin size={19} fill="currentColor" /></div>
            <div className="auth-promo-bike"><Bike size={79} strokeWidth={1.2} /></div><div className="auth-promo-parcel"><PackageCheck size={26} /></div>
            <span className="auth-spark auth-spark-one">✦</span><span className="auth-spark auth-spark-two">✳</span>
          </div>
          <div className="auth-promo-foot"><span><ShieldCheck size={15} /> Made for the community</span><span className="auth-promo-rating">★★★★★ <small>Neighbors helping neighbors</small></span></div>
        </section>

        <section className="auth-card" key={formKey}>
          <div className="auth-card-top"><div className="auth-card-mark"><Zap size={18} fill="currentColor" /></div><span className="auth-secure"><ShieldCheck size={13} /> SECURE ACCOUNT</span></div>
          <div className="auth-heading"><span className="auth-eyebrow">{isRecovery ? 'ACCOUNT RECOVERY' : screen === 'signup' ? 'GET STARTED' : 'YOUR QUICKHATID ACCOUNT'}</span><h2>{screen === 'forgot' && recoveryStep === 'success' ? 'Password updated!' : title}</h2><p>{screen === 'forgot' && recoveryStep === 'success' ? 'You can now sign in with your new password.' : subtitle}</p></div>
          {serviceError && <div className="auth-message error-message auth-service-error" role="alert">{serviceError}</div>}
          {successNotice && screen === 'signin' && <div className="auth-message success-message" role="status">{successNotice}</div>}
          {demoMode && <div className="auth-demo-note"><ShieldCheck size={13} /> EXHIBITION MODE · ACCOUNTS SAVED ON THIS BROWSER</div>}

          {screen === 'signin' && <form className="auth-form" onSubmit={handleLogin}>
            <label className="auth-field"><span>Email address or username</span><span className="auth-input-wrap"><UserRound size={16} /><input name="identifier" type="text" autoComplete="username" placeholder="Enter your email or username" required /></span>{fieldErrors.identifier && <small className="auth-field-error">{fieldErrors.identifier}</small>}</label>
            <PasswordInput name="password" label="Password" autoComplete="current-password" placeholder="Enter your password" />
            <div className="auth-form-options"><label className="auth-check"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span />Remember me</label><button className="auth-text-button" type="button" onClick={() => { setRecoveryStep('email'); changeScreen('forgot') }}>Forgot password?</button></div>
            {message && <div className="auth-message error-message" role="alert">{message}</div>}
            <button className="auth-submit" disabled={busy}>{busy ? <><span className="auth-spinner" /> Signing in...</> : <>Sign in <ArrowRight size={16} /></>}</button>
            <p className="auth-switch">New to QuickHatid? <button type="button" onClick={() => changeScreen('signup')}>Create an account</button></p>
          </form>}

          {screen === 'signup' && <form className="auth-form auth-signup-form" onSubmit={handleRegister}>
            <label className="auth-field"><span>Complete name</span><span className="auth-input-wrap"><UserRound size={16} /><input name="fullName" autoComplete="name" placeholder="Your full name" required maxLength={120} /></span>{fieldErrors.fullName && <small className="auth-field-error">{fieldErrors.fullName}</small>}</label>
            <label className="auth-field"><span>Username</span><span className="auth-input-wrap"><UserRound size={16} /><input name="username" autoComplete="username" placeholder="Choose a username" required minLength={3} maxLength={32} /></span>{fieldErrors.username && <small className="auth-field-error">{fieldErrors.username}</small>}</label>
            <div className="auth-two-fields">
              <label className="auth-field"><span>Email address</span><span className="auth-input-wrap"><Mail size={16} /><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></span>{fieldErrors.email && <small className="auth-field-error">{fieldErrors.email}</small>}</label>
              <label className="auth-field"><span>Mobile number</span><span className="auth-input-wrap"><span className="phone-prefix">+63</span><input name="mobileNumber" type="tel" autoComplete="tel" placeholder="917 123 4567" required /></span>{fieldErrors.mobileNumber && <small className="auth-field-error">{fieldErrors.mobileNumber}</small>}</label>
            </div>
            <div className="auth-two-fields">
              <PasswordInput name="password" label="Password" autoComplete="new-password" placeholder="10+ characters" />
              <PasswordInput name="confirmPassword" label="Confirm password" autoComplete="new-password" placeholder="Repeat password" />
            </div>
            {(fieldErrors.password || fieldErrors.confirmPassword) && <small className="auth-field-error">{fieldErrors.password || fieldErrors.confirmPassword}</small>}
            <label className="auth-check terms-check"><input type="checkbox" required /><span />I agree to the Terms and Conditions and Privacy Policy.</label>
            {message && <div className="auth-message error-message" role="alert">{message}</div>}
            <button className="auth-submit" disabled={busy}>{busy ? <><span className="auth-spinner" /> Creating account...</> : <>Create account <ArrowRight size={16} /></>}</button>
            <p className="auth-switch">Already have an account? <button type="button" onClick={() => changeScreen('signin')}>Sign in</button></p>
          </form>}

          {screen === 'forgot' && <div className="auth-recovery">
            <div className="recovery-steps"><span className={recoveryStep === 'email' ? 'step-current' : 'step-done'}><i>{recoveryStep === 'email' ? '1' : <Check size={12} />}</i>Email</span><b /><span className={recoveryStep === 'code' ? 'step-current' : ['reset', 'success'].includes(recoveryStep) ? 'step-done' : ''}><i>{['reset', 'success'].includes(recoveryStep) ? <Check size={12} /> : '2'}</i>Verify</span><b /><span className={recoveryStep === 'reset' ? 'step-current' : recoveryStep === 'success' ? 'step-done' : ''}><i>{recoveryStep === 'success' ? <Check size={12} /> : '3'}</i>Reset</span></div>
            {recoveryStep === 'email' && <form className="auth-form" onSubmit={requestCode}><label className="auth-field"><span>Registered email address</span><span className="auth-input-wrap"><Mail size={16} /><input name="email" type="email" autoComplete="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} placeholder="you@example.com" required /></span></label>{message && <div className={message.startsWith('If that') ? 'auth-message success-message' : 'auth-message error-message'} role="status">{message}</div>}<button className="auth-submit" disabled={busy}>{busy ? <><span className="auth-spinner" /> Sending code...</> : <>Send verification code <ArrowRight size={16} /></>}</button></form>}
            {recoveryStep === 'code' && <form className="auth-form" onSubmit={verifyCode}><div className="recovery-email-note"><Mail size={15} /> Enter the six-digit {demoMode ? 'exhibition verification code for' : 'code sent to'} <strong>{recoveryEmail}</strong>.</div>{demoMode && demoCode && <div className="auth-message demo-code-message" role="status"><KeyRound size={14} /> Demo verification code: <strong>{demoCode}</strong> <span>(not emailed)</span></div>}<label className="auth-field"><span>Verification code</span><span className="auth-input-wrap"><KeyRound size={16} /><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required /></span></label>{message && <div className={message.startsWith('If that') || message.startsWith('Exhibition') || message.startsWith('A new exhibition') ? 'auth-message success-message' : 'auth-message error-message'} role="status">{message}</div>}<button className="auth-submit" disabled={busy}>{busy ? <><span className="auth-spinner" /> Verifying...</> : <>Verify code <ArrowRight size={16} /></>}</button><button type="button" className="auth-resend" disabled={busy || secondsLeft > 0} onClick={resendCode}>Didn’t receive a code? <strong>{secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'}</strong></button></form>}
            {recoveryStep === 'reset' && <form className="auth-form" onSubmit={resetPassword}><div className="recovery-email-note"><ShieldCheck size={15} /> Email verified. Choose a new password for your account.</div><PasswordInput name="password" label="New password" autoComplete="new-password" placeholder="10+ characters" /><PasswordInput name="confirmPassword" label="Confirm new password" autoComplete="new-password" placeholder="Repeat new password" />{message && <div className="auth-message error-message" role="alert">{message}</div>}<button className="auth-submit" disabled={busy}>{busy ? <><span className="auth-spinner" /> Updating password...</> : <>Reset password <ArrowRight size={16} /></>}</button></form>}
            {recoveryStep === 'success' && <div className="auth-success-panel"><span className="auth-success-icon"><Check size={25} /></span><strong>Password successfully changed</strong><p>Your password has been updated. Sign in with your new password to continue.</p><button className="auth-submit" onClick={() => { setRecoveryStep('email'); setRecoveryEmail(''); changeScreen('signin') }}>Back to sign in <ArrowRight size={16} /></button></div>}
            {recoveryStep !== 'success' && <button className="auth-back-link" type="button" onClick={() => changeScreen('signin')}><ArrowLeft size={14} /> Back to sign in</button>}
          </div>}
          <div className="auth-card-footer"><LockKeyhole size={13} /> Your account details are protected with secure encryption.</div>
        </section>
      </div>
      <footer className="auth-footer"><span>© 2026 QuickHatid</span><span>Made with <span>♥</span> in Don Carlos, Bukidnon</span></footer>
    </main>
  )
}

export default AuthPage
