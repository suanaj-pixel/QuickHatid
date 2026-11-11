import 'dotenv/config'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'
import nodemailer from 'nodemailer'

const app = express()
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.PORT || 3001)
const isProduction = process.env.NODE_ENV === 'production'
const cookieName = 'qh_session'
const sessionSecret = process.env.SESSION_SECRET || (!isProduction ? crypto.randomBytes(48).toString('base64url') : '')

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters.')
}
if (!process.env.SESSION_SECRET && !isProduction) {
  console.warn('SESSION_SECRET is unset; using a temporary local-development key. Set it in .env to persist sessions across restarts.')
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'quickhatid_db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
  charset: 'utf8mb4',
})
const notificationWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many notification updates. Please try again later.' },
})
const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12)

app.disable('x-powered-by')
app.set('trust proxy', isProduction ? 1 : false)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'upgrade-insecure-requests': isProduction ? [] : null,
    },
  },
}))
app.use(express.json({ limit: '16kb' }))
app.use((req, res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {}
  next()
})
app.use(cookieParser())
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin')
    const allowedOrigins = new Set([
      process.env.APP_ORIGIN,
      ...(!isProduction ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : []),
    ].filter(Boolean))
    if (origin && !allowedOrigins.has(origin)) {
      return res.status(403).json({ error: 'Request origin is not allowed.' })
    }
  }
  next()
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
})
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many recovery attempts. Please try again later.' },
})

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const publicUser = (user) => ({
  id: Number(user.id),
  fullName: user.full_name,
  username: user.username,
  email: user.email,
  mobileNumber: user.mobile_number,
  role: user.role,
})
const publicNotification = (notification) => ({
  id: String(notification.id),
  title: notification.title,
  message: notification.message,
  type: notification.notification_type,
  relatedRequestId: notification.related_request_id,
  isRead: Boolean(notification.is_read),
  createdAt: new Date(notification.created_at).toISOString(),
})
async function createNotification(userId, { title, message, type = 'system', relatedRequestId = null }) {
  await pool.execute(
    `INSERT INTO notifications (user_id, title, message, notification_type, related_request_id)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, title, message, type, relatedRequestId],
  )
}
const tokenHash = (value) => crypto.createHmac('sha256', sessionSecret).update(value).digest('hex')
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const usernamePattern = /^[a-zA-Z0-9._-]{3,32}$/
const mobilePattern = /^\+?[0-9][0-9\s()-]{7,18}[0-9]$/

function validatePassword(password) {
  return typeof password === 'string'
    && password.length >= 10
    && password.length <= 72
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
}

async function createSession(userId, remember, res) {
  await pool.execute('DELETE FROM user_sessions WHERE expires_at <= UTC_TIMESTAMP(3)')
  const rawToken = crypto.randomBytes(32).toString('base64url')
  const lifetimeMs = remember ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000
  const expiresAt = new Date(Date.now() + lifetimeMs)
  await pool.execute(
    'INSERT INTO user_sessions (user_id, session_token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash(rawToken), expiresAt],
  )
  res.cookie(cookieName, rawToken, {
    ...cookieOptions,
    ...(remember ? { maxAge: lifetimeMs } : {}),
  })
  return rawToken
}

async function requireUser(req, res, next) {
  try {
    const authorization = req.get('authorization') || ''
    const bearerToken = authorization.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1]
    const rawToken = bearerToken || req.cookies[cookieName]
    if (!rawToken) return res.status(401).json({ error: 'Please sign in to continue.' })
    const [rows] = await pool.execute(
      `SELECT u.id, u.full_name, u.username, u.email, u.mobile_number, u.role
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.session_token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3)
         AND u.account_status = 'active'
       LIMIT 1`,
      [tokenHash(rawToken)],
    )
    if (!rows.length) {
      res.clearCookie(cookieName, cookieOptions)
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    }
    req.user = rows[0]
    next()
  } catch (error) {
    next(error)
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to access this resource.' })
    }
    next()
  }
}

function getMailer() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length) {
    const error = new Error(`Email delivery is not configured. Missing: ${missing.join(', ')}`)
    error.status = 503
    throw error
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  })
}

async function sendRecoveryCode(email, code) {
  const mailer = getMailer()
  await mailer.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Your QuickHatid password reset code',
    text: `Your QuickHatid verification code is ${code}. It expires in 5 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your QuickHatid verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>`,
  })
}

app.get('/api/health', asyncRoute(async (req, res) => {
  if (!process.env.DB_USER) {
    return res.status(503).json({
      ok: false,
      error: 'MySQL is not configured. Run `npm run setup:db` in the project terminal; it will ask for your MySQL administrator password locally and configure QuickHatid.',
    })
  }
  try {
    await pool.query('SELECT 1 FROM users LIMIT 0')
    return res.json({ ok: true, database: 'connected' })
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ ok: false, error: 'MySQL is not running. Start the MySQL server, then try again.' })
    }
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      return res.status(503).json({ ok: false, error: 'MySQL rejected the configured credentials. Check DB_USER and DB_PASSWORD in .env.' })
    }
    if (error.code === 'ER_BAD_DB_ERROR') {
      return res.status(503).json({ ok: false, error: 'The quickhatid_db database does not exist. Import database/schema.sql into MySQL.' })
    }
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ ok: false, error: 'QuickHatid authentication tables are missing. Import database/schema.sql into MySQL.' })
    }
    throw error
  }
}))

app.get('/api/auth/me', requireUser, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

app.get('/api/notifications', requireUser, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT id, title, message, notification_type, related_request_id, is_read, created_at
     FROM notifications WHERE user_id = ?
     ORDER BY created_at DESC, id DESC LIMIT 100`,
    [req.user.id],
  )
  res.json({ notifications: rows.map(publicNotification) })
}))

app.get('/api/requests', requireUser, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT request_code, request_kind, service, pickup_location, destination,
            details, instructions, service_fee, status, created_at
     FROM service_requests WHERE user_id = ?
     ORDER BY created_at DESC, id DESC LIMIT 100`,
    [req.user.id],
  )
  res.json({
    requests: rows.map((request) => ({
      id: request.request_code,
      kind: request.request_kind,
      service: request.service,
      from: request.pickup_location,
      to: request.destination,
      details: request.details,
      instructions: request.instructions,
      fee: Number(request.service_fee),
      status: request.status,
      date: new Date(request.created_at).toISOString(),
    })),
  })
}))

app.post('/api/requests', requireUser, asyncRoute(async (req, res) => {
  const kind = String(req.body.kind || '')
  const service = String(req.body.service || '').trim()
  const pickup = String(req.body.from || '').trim()
  const destination = String(req.body.to || '').trim()
  const details = String(req.body.details || '').trim()
  const instructions = String(req.body.instructions || '').trim()
  const serviceFees = {
    'Motorcycle ride': 50,
    'Point-to-point travel': 80,
    'Grocery shopping': 80,
    'Food pickup': 60,
    'Food & parcel pickup': 60,
    'Medicine pickup': 70,
    'Documents & more': 65,
    'Document delivery': 65,
  }
  if (!['ride', 'errand'].includes(kind)
    || !Object.hasOwn(serviceFees, service)
    || (kind === 'ride') !== ['Motorcycle ride', 'Point-to-point travel'].includes(service)
    || pickup.length < 2 || pickup.length > 200
    || destination.length < 2 || destination.length > 200
    || details.length > 1000
    || instructions.length > 500) {
    return res.status(400).json({ error: 'Check the ride or errand details and try again.' })
  }
  const requestCode = `QH-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
  const fee = serviceFees[service]
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(
      `INSERT INTO service_requests
         (user_id, request_code, request_kind, service, pickup_location, destination, details, instructions, service_fee)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, requestCode, kind, service, pickup, destination, details, instructions, fee],
    )
    await connection.execute(
      `INSERT INTO notifications (user_id, title, message, notification_type, related_request_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.user.id,
        kind === 'ride' ? 'Ride request submitted' : 'Errand request submitted',
        'Your request was submitted and is waiting for a rider.',
        kind,
        requestCode,
      ],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  res.status(201).json({
    request: {
      id: requestCode,
      kind,
      service,
      from: pickup,
      to: destination,
      details,
      instructions,
      fee,
      status: 'Pending',
      date: new Date().toISOString(),
    },
  })
}))

app.post('/api/notifications', requireUser, notificationWriteLimiter, asyncRoute(async (req, res) => {
  const title = String(req.body.title || '').trim()
  const message = String(req.body.message || '').trim()
  const type = String(req.body.type || 'system')
  const relatedRequestId = req.body.relatedRequestId == null ? null : String(req.body.relatedRequestId).trim()
  if (title.length < 1 || title.length > 160 || message.length < 1 || message.length > 500) {
    return res.status(400).json({ error: 'Enter a notification title and message within the allowed length.' })
  }
  if (!['ride', 'errand', 'account', 'system'].includes(type)) {
    return res.status(400).json({ error: 'The notification type is not supported.' })
  }
  if (relatedRequestId && relatedRequestId.length > 64) {
    return res.status(400).json({ error: 'The related request ID is too long.' })
  }
  await createNotification(req.user.id, { title, message, type, relatedRequestId })
  res.status(201).json({ message: 'Notification saved.' })
}))

app.patch('/api/notifications/read-all', requireUser, notificationWriteLimiter, asyncRoute(async (req, res) => {
  await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id])
  res.json({ message: 'All notifications marked as read.' })
}))

app.patch('/api/notifications/:id/read', requireUser, notificationWriteLimiter, asyncRoute(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'The notification ID is invalid.' })
  const [result] = await pool.execute(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
  )
  if (!result.affectedRows) return res.status(404).json({ error: 'Notification not found.' })
  res.json({ message: 'Notification marked as read.' })
}))

app.post('/api/auth/register', authLimiter, asyncRoute(async (req, res) => {
  const fullName = String(req.body.fullName || '').trim()
  const username = String(req.body.username || '').trim()
  const email = normalizeEmail(req.body.email)
  const mobileNumber = String(req.body.mobileNumber || '').trim()
  const password = req.body.password
  const confirmPassword = req.body.confirmPassword
  const errors = {}
  if (fullName.length < 2 || fullName.length > 120) errors.fullName = 'Enter your complete name.'
  if (!usernamePattern.test(username)) errors.username = 'Use 3–32 letters, numbers, dots, underscores, or hyphens.'
  if (!emailPattern.test(email) || email.length > 254) errors.email = 'Enter a valid email address.'
  if (!mobilePattern.test(mobileNumber)) errors.mobileNumber = 'Enter a valid mobile number.'
  if (!validatePassword(password)) errors.password = 'Use 10–72 characters with uppercase, lowercase, a number, and a symbol.'
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields.', fields: errors })

  const passwordHash = await bcrypt.hash(password, 12)
  let result
  try {
    ;[result] = await pool.execute(
      `INSERT INTO users (full_name, username, email, mobile_number, password_hash, role)
       VALUES (?, ?, ?, ?, ?, 'customer')`,
      [fullName, username, email, mobileNumber, passwordHash],
    )
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const [existing] = await pool.execute('SELECT username, email FROM users WHERE username = ? OR email = ? LIMIT 1', [username, email])
      const fields = {}
      if (existing[0]?.username.toLowerCase() === username.toLowerCase()) fields.username = 'That username is already taken.'
      if (existing[0]?.email === email) fields.email = 'That email is already registered.'
      return res.status(409).json({ error: 'An account already uses those details.', fields })
    }
    throw error
  }

  const [users] = await pool.execute(
    'SELECT id, full_name, username, email, mobile_number, role FROM users WHERE id = ?',
    [result.insertId],
  )
  await createNotification(result.insertId, {
    title: 'Welcome to QuickHatid',
    message: 'Your account is ready. Start by booking a ride or requesting an errand.',
    type: 'account',
  })
  const accessToken = await createSession(result.insertId, true, res)
  res.status(201).json({
    user: publicUser(users[0]),
    message: 'Your QuickHatid account is ready.',
    ...(req.get('x-quickhatid-client') === 'native' ? { accessToken } : {}),
  })
}))

app.post('/api/auth/login', authLimiter, asyncRoute(async (req, res) => {
  const identifier = String(req.body.identifier || '').trim()
  const password = req.body.password
  if (!identifier || typeof password !== 'string' || password.length > 72) {
    return res.status(400).json({ error: 'Enter your email or username and password.' })
  }
  const [users] = await pool.execute(
    `SELECT id, full_name, username, email, mobile_number, password_hash, role, account_status
     FROM users WHERE email = ? OR username = ? LIMIT 1`,
    [normalizeEmail(identifier), identifier],
  )
  const user = users[0]
  const passwordMatches = await bcrypt.compare(password, user?.password_hash || dummyPasswordHash)
  if (!user || !passwordMatches || user.account_status !== 'active') {
    return res.status(401).json({ error: 'The email/username or password is incorrect.' })
  }
  const previousToken = req.cookies[cookieName]
  if (previousToken) await pool.execute('DELETE FROM user_sessions WHERE session_token_hash = ?', [tokenHash(previousToken)])
  const accessToken = await createSession(user.id, req.body.remember === true, res)
  res.json({
    user: publicUser(user),
    message: 'Signed in successfully.',
    ...(req.get('x-quickhatid-client') === 'native' ? { accessToken } : {}),
  })
}))

app.post('/api/auth/logout', asyncRoute(async (req, res) => {
  const authorization = req.get('authorization') || ''
  const bearerToken = authorization.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1]
  const rawToken = bearerToken || req.cookies[cookieName]
  if (rawToken) {
    await pool.execute('DELETE FROM user_sessions WHERE session_token_hash = ?', [tokenHash(rawToken)])
  }
  res.clearCookie(cookieName, cookieOptions)
  res.json({ message: 'Signed out successfully.' })
}))

app.patch('/api/auth/profile', requireUser, asyncRoute(async (req, res) => {
  const fullName = String(req.body.fullName || '').trim()
  const mobileNumber = String(req.body.mobileNumber || '').trim()
  const fields = {}
  if (fullName.length < 2 || fullName.length > 120) fields.fullName = 'Enter your complete name.'
  if (!mobilePattern.test(mobileNumber)) fields.mobileNumber = 'Enter a valid mobile number.'
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Please check the highlighted fields.', fields })
  await pool.execute(
    'UPDATE users SET full_name = ?, mobile_number = ? WHERE id = ?',
    [fullName, mobileNumber, req.user.id],
  )
  const [users] = await pool.execute(
    'SELECT id, full_name, username, email, mobile_number, role FROM users WHERE id = ?',
    [req.user.id],
  )
  await createNotification(req.user.id, {
    title: 'Account information updated',
    message: 'Your profile information was updated successfully.',
    type: 'account',
  })
  res.json({ user: publicUser(users[0]), message: 'Profile updated successfully.' })
}))

app.post('/api/auth/change-password', requireUser, authLimiter, asyncRoute(async (req, res) => {
  const currentPassword = req.body.currentPassword
  const newPassword = req.body.newPassword
  if (!validatePassword(newPassword)) {
    return res.status(400).json({ error: 'Use 10–72 characters with uppercase, lowercase, a number, and a symbol.' })
  }
  if (newPassword !== req.body.confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' })
  const [users] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id])
  if (!users.length || typeof currentPassword !== 'string' || !await bcrypt.compare(currentPassword, users[0].password_hash)) {
    return res.status(401).json({ error: 'Your current password is incorrect.' })
  }
  const passwordHash = await bcrypt.hash(newPassword, 12)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id])
    await connection.execute('DELETE FROM user_sessions WHERE user_id = ?', [req.user.id])
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  await createSession(req.user.id, false, res)
  await createNotification(req.user.id, {
    title: 'Password changed',
    message: 'Your password was changed successfully.',
    type: 'account',
  })
  res.json({ message: 'Password changed successfully.' })
}))

app.post('/api/auth/forgot-password', recoveryLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email)
  if (!emailPattern.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' })
  const [users] = await pool.execute(
    'SELECT id, email FROM users WHERE email = ? AND account_status = ? LIMIT 1',
    [email, 'active'],
  )
  if (!users.length) return res.json({ message: 'If that email belongs to an active account, a code will be sent.' })

  const [existing] = await pool.execute(
    'SELECT id, created_at FROM password_resets WHERE email = ? ORDER BY created_at DESC LIMIT 1',
    [email],
  )
  if (existing[0] && Date.now() - new Date(existing[0].created_at).getTime() < 60_000) {
    return res.status(429).json({ error: 'Please wait 60 seconds before requesting another code.' })
  }

  const code = String(crypto.randomInt(100000, 1000000))
  const codeHash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute('DELETE FROM password_resets WHERE email = ?', [email])
    await connection.execute(
      'INSERT INTO password_resets (email, verification_code_hash, expires_at) VALUES (?, ?, ?)',
      [email, codeHash, expiresAt],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  try {
    await sendRecoveryCode(email, code)
  } catch (error) {
    await pool.execute('DELETE FROM password_resets WHERE email = ?', [email])
    throw error
  }
  res.json({ message: 'If that email belongs to an active account, a code will be sent.' })
}))

app.post('/api/auth/verify-reset-code', recoveryLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const code = String(req.body.code || '').trim()
  if (!emailPattern.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter the email and six-digit verification code.' })
  }
  const connection = await pool.getConnection()
  let resetToken
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute(
      `SELECT id, verification_code_hash, attempts
       FROM password_resets
       WHERE email = ? AND expires_at > UTC_TIMESTAMP(3) AND verified_at IS NULL
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [email],
    )
    const reset = rows[0]
    if (!reset || reset.attempts >= 5) {
      await connection.rollback()
      return res.status(400).json({ error: 'That code is invalid or expired. Request a new code.' })
    }
    await connection.execute('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?', [reset.id])
    if (!await bcrypt.compare(code, reset.verification_code_hash)) {
      await connection.commit()
      return res.status(400).json({ error: `Incorrect code. ${4 - reset.attempts} attempt(s) remaining.` })
    }
    resetToken = crypto.randomBytes(32).toString('base64url')
    await connection.execute(
      'UPDATE password_resets SET verified_at = UTC_TIMESTAMP(3), reset_token_hash = ? WHERE id = ?',
      [tokenHash(resetToken), reset.id],
    )
    await connection.execute(
      'UPDATE users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP(3)) WHERE email = ?',
      [email],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  res.cookie('qh_password_reset', resetToken, {
    ...cookieOptions,
    maxAge: 5 * 60 * 1000,
  })
  res.json({ message: 'Email verified. You can now reset your password.' })
}))

app.post('/api/auth/reset-password', recoveryLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const password = req.body.password
  if (!emailPattern.test(email)) return res.status(400).json({ error: 'The password reset session is invalid. Start again.' })
  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'Use 10–72 characters with uppercase, lowercase, a number, and a symbol.' })
  }
  if (password !== req.body.confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' })

  const resetToken = req.cookies.qh_password_reset
  if (!resetToken) return res.status(403).json({ error: 'Verify your email code before resetting your password.' })
  const passwordHash = await bcrypt.hash(password, 12)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [resets] = await connection.execute(
      `SELECT id FROM password_resets
       WHERE email = ? AND verified_at IS NOT NULL AND expires_at > UTC_TIMESTAMP(3)
         AND reset_token_hash = ?
       ORDER BY verified_at DESC LIMIT 1 FOR UPDATE`,
      [email, tokenHash(resetToken)],
    )
    if (!resets.length) {
      await connection.rollback()
      return res.status(403).json({ error: 'Verify your email code before resetting your password.' })
    }
    await connection.execute('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, email])
    await connection.execute('DELETE FROM password_resets WHERE email = ?', [email])
    await connection.execute(
      'DELETE s FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE u.email = ?',
      [email],
    )
    await connection.execute(
      `INSERT INTO notifications (user_id, title, message, notification_type)
       SELECT id, 'Password changed', 'Your password was changed successfully.', 'account'
       FROM users WHERE email = ?`,
      [email],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  res.clearCookie(cookieName, cookieOptions)
  res.clearCookie('qh_password_reset', cookieOptions)
  res.json({ message: 'Password successfully changed.' })
}))

app.get('/api/admin/overview', requireUser, requireRole('admin'), (req, res) => {
  res.json({ message: 'Administrator access granted.' })
})
app.get('/api/rider/overview', requireUser, requireRole('rider'), (req, res) => {
  res.json({ message: 'Rider access granted.' })
})

if (isProduction) {
  app.use(express.static(path.join(projectRoot, 'dist'), { index: false }))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(projectRoot, 'dist', 'index.html'))
  })
}

app.use((error, req, res, next) => {
  console.error('API request failed:', error.message)
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({ error: 'MySQL is not running. Start the MySQL server, then try again.' })
  }
  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(503).json({ error: 'MySQL rejected the configured credentials. Run `npm run setup:db` and enter your MySQL administrator login locally to create working QuickHatid credentials.' })
  }
  if (error.code === 'ER_BAD_DB_ERROR') {
    return res.status(503).json({ error: 'The quickhatid_db database does not exist. Run `npm run setup:db` to create the database and tables.' })
  }
  if (error.code === 'ER_NO_SUCH_TABLE') {
    return res.status(503).json({ error: 'A required QuickHatid database table is missing. Run `npm run setup:db` to apply the database schema.' })
  }
  const status = Number(error.status) || 500
  res.status(status).json({
    error: status === 500 ? 'The request could not be completed. Check the server configuration and try again.' : error.message,
  })
})

app.listen(port, () => {
  console.log(`QuickHatid API listening on http://127.0.0.1:${port}`)
})
