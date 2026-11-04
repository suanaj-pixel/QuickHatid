const USERS_KEY = 'quickhatid-demo-users'
const SESSION_KEY = 'quickhatid-demo-session'
const RESET_KEY = 'quickhatid-demo-reset'
const NOTIFICATIONS_PREFIX = 'quickhatid-demo-notifications:'
const PASSWORD_ITERATIONS = 210_000
const textEncoder = new TextEncoder()

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    throw new Error('Demo account storage is unavailable. Enable browser storage and try again.')
  }
}

function readStringStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    throw new Error('Demo account storage is unavailable. Enable browser storage and try again.')
  }
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    mobileNumber: user.mobileNumber,
    role: user.role,
  }
}

function notificationsKey(userId) {
  return `${NOTIFICATIONS_PREFIX}${userId}`
}

function createDemoNotification(userId, notification) {
  const key = notificationsKey(userId)
  const existing = readStorage(key, [])
  const item = {
    id: crypto.randomUUID(),
    title: notification.title,
    message: notification.message,
    type: notification.type || 'system',
    relatedRequestId: notification.relatedRequestId || null,
    isRead: false,
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(key, JSON.stringify([item, ...existing].slice(0, 100)))
  return item
}

function validatePassword(password) {
  return typeof password === 'string'
    && password.length >= 10
    && password.length <= 72
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
}

function emailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254
}

function mobileValid(mobile) {
  return /^\+?[0-9][0-9\s()-]{7,18}[0-9]$/.test(mobile)
}

function encodeBase64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

async function derivePasswordBits(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  ))
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const digest = await derivePasswordBits(password, salt, PASSWORD_ITERATIONS)
  return `pbkdf2$${PASSWORD_ITERATIONS}$${encodeBase64(salt)}$${encodeBase64(digest)}`
}

async function verifyPassword(password, storedHash) {
  const [algorithm, iterationValue, saltValue, expectedValue] = String(storedHash || '').split('$')
  const iterations = Number(iterationValue)
  if (algorithm !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false
  const actual = await derivePasswordBits(password, decodeBase64(saltValue), iterations)
  const expected = decodeBase64(expectedValue)
  if (actual.length !== expected.length) return false
  let mismatch = 0
  for (let index = 0; index < actual.length; index += 1) mismatch |= actual[index] ^ expected[index]
  return mismatch === 0
}

export async function getDemoSession() {
  const sessionId = readStringStorage(SESSION_KEY)
  if (!sessionId) return null
  const users = readStorage(USERS_KEY, [])
  const user = users.find((entry) => entry.id === sessionId)
  if (!user) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  return publicUser(user)
}

export async function demoRequest(path, data = {}) {
  const users = readStorage(USERS_KEY, [])
  if (path === '/api/notifications/create') {
    const sessionId = readStringStorage(SESSION_KEY)
    if (!sessionId || !users.some((user) => user.id === sessionId)) throw new Error('Please sign in to create a notification.')
    const title = String(data.title || '').trim()
    const message = String(data.message || '').trim()
    if (!title || title.length > 160 || !message || message.length > 500) {
      throw new Error('Enter a notification title and message within the allowed length.')
    }
    if (!['ride', 'errand', 'account', 'system'].includes(data.type || 'system')) {
      throw new Error('The notification type is not supported.')
    }
    return { notification: createDemoNotification(sessionId, { ...data, title, message }) }
  }

  if (path === '/api/notifications' || path === '/api/notifications/read-all' || path.startsWith('/api/notifications/')) {
    const sessionId = readStringStorage(SESSION_KEY)
    if (!sessionId || !users.some((user) => user.id === sessionId)) throw new Error('Please sign in to view your notifications.')
    const key = notificationsKey(sessionId)
    const notifications = readStorage(key, [])
    if (path === '/api/notifications') return { notifications }
    if (path === '/api/notifications/read-all') {
      localStorage.setItem(key, JSON.stringify(notifications.map((item) => ({ ...item, isRead: true }))))
      return { message: 'All notifications marked as read.' }
    }
    const notificationId = path.slice('/api/notifications/'.length).replace(/\/read$/, '')
    if (!path.endsWith('/read')) throw new Error('This exhibition notification action is not available.')
    const updated = notifications.map((item) => item.id === notificationId ? { ...item, isRead: true } : item)
    if (!updated.some((item) => item.id === notificationId)) throw new Error('Notification not found.')
    localStorage.setItem(key, JSON.stringify(updated))
    return { message: 'Notification marked as read.' }
  }

  if (path === '/api/auth/register') {
    const fullName = String(data.fullName || '').trim()
    const username = String(data.username || '').trim()
    const email = String(data.email || '').trim().toLowerCase()
    const mobileNumber = String(data.mobileNumber || '').trim()
    const fields = {}
    if (fullName.length < 2 || fullName.length > 120) fields.fullName = 'Enter your complete name.'
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) fields.username = 'Use 3–32 letters, numbers, dots, underscores, or hyphens.'
    if (!emailValid(email)) fields.email = 'Enter a valid email address.'
    if (!mobileValid(mobileNumber)) fields.mobileNumber = 'Enter a valid mobile number.'
    if (!validatePassword(data.password)) fields.password = 'Use 10–72 characters with uppercase, lowercase, a number, and a symbol.'
    if (data.password !== data.confirmPassword) fields.confirmPassword = 'Passwords do not match.'
    if (Object.keys(fields).length) {
      const error = new Error('Please check the highlighted fields.')
      error.fields = fields
      throw error
    }
    if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
      const error = new Error('That username is already taken.')
      error.fields = { username: error.message }
      throw error
    }
    if (users.some((user) => user.email === email)) {
      const error = new Error('That email is already registered.')
      error.fields = { email: error.message }
      throw error
    }
    const user = {
      id: crypto.randomUUID(),
      fullName,
      username,
      email,
      mobileNumber,
      passwordHash: await hashPassword(data.password),
      role: 'customer',
    }
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]))
    localStorage.setItem(SESSION_KEY, user.id)
    createDemoNotification(user.id, {
      title: 'Welcome to QuickHatid',
      message: 'Your account is ready. Start by booking a ride or requesting an errand.',
      type: 'account',
    })
    return { user: publicUser(user), message: 'Exhibition account created and saved in this browser.' }
  }

  if (path === '/api/auth/login') {
    const identifier = String(data.identifier || '').trim()
    const user = users.find((entry) =>
      entry.email === identifier.toLowerCase() || entry.username.toLowerCase() === identifier.toLowerCase(),
    )
    if (!user || !await verifyPassword(String(data.password || ''), user.passwordHash)) {
      throw new Error('The email/username or password is incorrect.')
    }
    localStorage.setItem(SESSION_KEY, user.id)
    return { user: publicUser(user), message: 'Signed in to your exhibition account.' }
  }

  if (path === '/api/auth/logout') {
    localStorage.removeItem(SESSION_KEY)
    return { message: 'Signed out successfully.' }
  }

  if (path === '/api/auth/forgot-password') {
    const email = String(data.email || '').trim().toLowerCase()
    if (!emailValid(email)) throw new Error('Enter a valid email address.')
    const user = users.find((entry) => entry.email === email)
    if (!user) throw new Error('No exhibition account is registered with that email.')
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    const code = String(100000 + (values[0] % 900000))
    localStorage.setItem(RESET_KEY, JSON.stringify({
      email,
      codeHash: await hashPassword(code),
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
      verified: false,
    }))
    return { message: 'Exhibition mode does not send email. Use the demo code shown below.', demoCode: code }
  }

  if (path === '/api/auth/verify-reset-code') {
    const reset = readStorage(RESET_KEY, null)
    const code = String(data.code || '').trim()
    if (!reset || reset.email !== String(data.email || '').trim().toLowerCase() || reset.expiresAt <= Date.now() || reset.attempts >= 5) {
      throw new Error('That code is invalid or expired. Request a new code.')
    }
    reset.attempts += 1
    localStorage.setItem(RESET_KEY, JSON.stringify(reset))
    if (!await verifyPassword(code, reset.codeHash)) {
      throw new Error(`Incorrect code. ${5 - reset.attempts} attempt(s) remaining.`)
    }
    reset.verified = true
    localStorage.setItem(RESET_KEY, JSON.stringify(reset))
    return { message: 'Email verified for this exhibition demo.' }
  }

  if (path === '/api/auth/reset-password') {
    const email = String(data.email || '').trim().toLowerCase()
    const reset = readStorage(RESET_KEY, null)
    if (!reset || !reset.verified || reset.email !== email || reset.expiresAt <= Date.now()) {
      throw new Error('Verify your email code before resetting your password.')
    }
    if (!validatePassword(data.password)) {
      throw new Error('Use 10–72 characters with uppercase, lowercase, a number, and a symbol.')
    }
    if (data.password !== data.confirmPassword) throw new Error('Passwords do not match.')
    const updatedUsers = await Promise.all(users.map(async (user) => user.email === email
      ? { ...user, passwordHash: await hashPassword(data.password) }
      : user))
    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers))
    const updatedUser = updatedUsers.find((user) => user.email === email)
    if (updatedUser) createDemoNotification(updatedUser.id, {
      title: 'Password changed',
      message: 'Your password was changed successfully.',
      type: 'account',
    })
    localStorage.removeItem(RESET_KEY)
    localStorage.removeItem(SESSION_KEY)
    return { message: 'Password successfully changed.' }
  }

  if (path === '/api/auth/profile') {
    const sessionId = readStringStorage(SESSION_KEY)
    const fullName = String(data.fullName || '').trim()
    const mobileNumber = String(data.mobileNumber || '').trim()
    const fields = {}
    if (fullName.length < 2 || fullName.length > 120) fields.fullName = 'Enter your complete name.'
    if (!mobileValid(mobileNumber)) fields.mobileNumber = 'Enter a valid mobile number.'
    if (Object.keys(fields).length) {
      const error = new Error('Please check the highlighted fields.')
      error.fields = fields
      throw error
    }
    const updatedUsers = users.map((user) => user.id === sessionId ? { ...user, fullName, mobileNumber } : user)
    const user = updatedUsers.find((entry) => entry.id === sessionId)
    if (!user) throw new Error('Please sign in again to update your profile.')
    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers))
    createDemoNotification(sessionId, {
      title: 'Account information updated',
      message: 'Your profile information was updated successfully.',
      type: 'account',
    })
    return { user: publicUser(user), message: 'Exhibition profile updated in this browser.' }
  }

  if (path === '/api/auth/change-password') {
    const sessionId = readStringStorage(SESSION_KEY)
    const user = users.find((entry) => entry.id === sessionId)
    if (!user || !await verifyPassword(String(data.currentPassword || ''), user.passwordHash)) {
      throw new Error('Your current password is incorrect.')
    }
    if (!validatePassword(data.newPassword)) {
      throw new Error('Use 10–72 characters with uppercase, lowercase, a number, and a symbol.')
    }
    if (data.newPassword !== data.confirmPassword) throw new Error('Passwords do not match.')
    const updatedUsers = await Promise.all(users.map(async (entry) => entry.id === sessionId
      ? { ...entry, passwordHash: await hashPassword(data.newPassword) }
      : entry))
    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers))
    createDemoNotification(sessionId, {
      title: 'Password changed',
      message: 'Your password was changed successfully.',
      type: 'account',
    })
    return { message: 'Exhibition password updated in this browser.' }
  }

  throw new Error('This exhibition action is not available.')
}
