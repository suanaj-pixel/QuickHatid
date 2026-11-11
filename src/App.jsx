import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, Bike, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, CreditCard, Info,
  FileText, Headphones, Heart, Home, LogOut, MapPin, Menu, MoreHorizontal, PackageCheck,
  PackageOpen, Plus, Search, Settings, ShieldCheck, ShoppingBag, ShoppingBasket,
  Star, Store, Truck, UserRound, Wallet, X, Zap,
} from 'lucide-react'
import AboutUs from './aboutus.jsx'
import AuthPage from './auth.jsx'
import { demoRequest, getDemoSession } from './demo-auth.js'
import './header.css'
import './notification.css'
import './ride-booking.css'
import './profile-page.css'
import './errand-delivery.css'
import './user-menu.css'

const initialRequests = [
  { id: 'QH-24098', service: 'Motorcycle ride', kind: 'ride', from: 'Poblacion, Don Carlos', to: 'Don Carlos Public Market', date: 'Today, 10:24 AM', fee: 85, status: 'Rider on the way', rider: 'Jomar R.', initials: 'JR', color: 'blue' },
  { id: 'QH-24076', service: 'Grocery shopping', kind: 'errand', from: 'Rose Pharmacy', to: 'San Francisco, Don Carlos', date: 'Yesterday, 4:18 PM', fee: 120, status: 'Completed', rider: 'Mika S.', initials: 'MS', color: 'pink' },
  { id: 'QH-24051', service: 'Food pickup', kind: 'errand', from: 'Poblacion, Don Carlos', to: 'Barangay Sinangguyan', date: 'Oct 28, 1:05 PM', fee: 65, status: 'Completed', rider: 'Jomar R.', initials: 'JR', color: 'blue' },
]

const services = [
  { title: 'Motorcycle ride', description: 'Get there quickly, skip the wait.', fee: 'From ₱50', icon: Bike, tone: 'orange', kind: 'ride' },
  { title: 'Grocery shopping', description: 'Your list, picked up and delivered.', fee: 'From ₱80', icon: ShoppingBasket, tone: 'green', kind: 'errand' },
  { title: 'Food pickup', description: 'Craving something? We’ll get it.', fee: 'From ₱60', icon: ShoppingBag, tone: 'yellow', kind: 'errand' },
  { title: 'Medicine pickup', description: 'Essentials brought to your door.', fee: 'From ₱70', icon: Heart, tone: 'pink', kind: 'errand' },
]

const navItems = [
  { label: 'Overview', icon: Home, page: 'Overview' },
  { label: 'Book a ride', icon: Bike, page: 'Book a ride', badge: 'New' },
  { label: 'Errand delivery', icon: PackageOpen, page: 'Errand delivery' },
  { label: 'My requests', icon: FileText, page: 'My requests', count: '2' },
  { label: 'Transactions', icon: CreditCard, page: 'Transactions' },
  { label: 'About QuickHatid', icon: Info, page: 'About Us' },
]

function readRequests() {
  try {
    const saved = localStorage.getItem('quickhatid-requests')
    return saved ? JSON.parse(saved) : initialRequests
  } catch {
    return initialRequests
  }
}

function Status({ children }) {
  const cls = children === 'Completed' ? 'complete' : children === 'Cancelled' ? 'cancelled' : 'active'
  return <span className={`status ${cls}`}><i />{children}</span>
}

function UserAvatar({ user, className = '' }) {
  const picture = user?.profilePicture || user?.profile_picture || ''
  const fullName = String(user?.fullName || '').trim()
  const initials = fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return (
    <span className={`avatar avatar-user ${className}`.trim()}>
      {picture ? <img src={picture} alt="" /> : initials}
    </span>
  )
}

function HeaderDateTime() {
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const date = currentTime.toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const shortDate = currentTime.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const time = currentTime.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className="header-datetime">
      <CalendarDays size={15} aria-hidden="true" />
      <time dateTime={currentTime.toISOString()}>
        <span className="header-date-full">{date}</span>
        <span className="header-date-short">{shortDate}</span>
        <strong>{time}</strong>
      </time>
    </div>
  )
}

function App() {
  const demoMode = import.meta.env.VITE_AUTH_MODE !== 'mysql'
  const [requests, setRequests] = useState(readRequests)
  const [page, setPage] = useState('Overview')
  const [modal, setModal] = useState(null)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('Customer')
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [authSuccessNotice, setAuthSuccessNotice] = useState('')
  const [notifications, setNotifications] = useState([])
  const [notificationError, setNotificationError] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationPanelMounted, setNotificationPanelMounted] = useState(false)
  const [notificationPanelClosing, setNotificationPanelClosing] = useState(false)
  const [notificationPulse, setNotificationPulse] = useState(false)
  const [notice, setNotice] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [authServiceError, setAuthServiceError] = useState('')
  const accountMenuRef = useRef(null)
  const notificationWrapRef = useRef(null)
  const notificationCloseTimerRef = useRef(null)
  const notificationPulseTimerRef = useRef(null)
  const previousUnreadCountRef = useRef(0)

  useEffect(() => {
    let active = true
    async function restoreSession() {
      try {
        if (demoMode) {
          const user = await getDemoSession()
          if (active && user) {
            setAuthUser(user)
            setRole('Customer')
          }
          return
        }
        const healthResponse = await fetch('/api/health')
        const health = await healthResponse.json().catch(() => ({}))
        if (!healthResponse.ok) {
          if (active) setAuthServiceError(health.error || 'Authentication service is not ready.')
          return
        }
        const response = await fetch('/api/auth/me', { credentials: 'include' })
        const result = await response.json().catch(() => ({}))
        if (!active) return
        if (response.ok) {
          setAuthUser(result.user)
          setRole(result.user.role === 'admin' ? 'Admin' : result.user.role === 'rider' ? 'Rider' : 'Customer')
        } else if (response.status !== 401) {
          setAuthServiceError(result.error || 'Authentication service is unavailable.')
        }
      } catch {
        if (active) setAuthServiceError(demoMode
          ? 'Browser storage is not available. Enable local storage to use exhibition accounts.'
          : 'Cannot reach the QuickHatid API. Start the frontend and API together with `npm run dev`, then try again.')
      } finally {
        if (active) setAuthChecking(false)
      }
    }
    restoreSession()
    return () => { active = false }
  }, [demoMode])

  useEffect(() => {
    localStorage.setItem('quickhatid-requests', JSON.stringify(requests))
  }, [requests])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  async function notificationRequest(path, method = 'GET', data = {}) {
    if (demoMode) {
      if (method === 'POST' && path === '/api/notifications') {
        return demoRequest('/api/notifications/create', data)
      }
      return demoRequest(path)
    }
    const response = await fetch(path, {
      method,
      credentials: 'include',
      ...(method !== 'GET' ? {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      } : {}),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Could not update notifications.')
    return result
  }

  async function loadNotifications() {
    if (!authUser) {
      setNotifications([])
      setNotificationError('')
      return
    }
    try {
      const result = await notificationRequest('/api/notifications')
      setNotifications(Array.isArray(result.notifications) ? result.notifications : [])
      setNotificationError('')
    } catch (error) {
      setNotificationError(error.message)
    }
  }

  async function createNotification(notification) {
    try {
      await notificationRequest('/api/notifications', 'POST', notification)
      await loadNotifications()
    } catch (error) {
      setNotificationError(error.message)
    }
  }

  async function markNotificationRead(notificationId) {
    try {
      await notificationRequest(`/api/notifications/${encodeURIComponent(notificationId)}/read`, 'PATCH')
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, isRead: true } : item))
      setNotificationError('')
    } catch (error) {
      setNotificationError(error.message)
    }
  }

  async function markAllNotificationsRead() {
    try {
      await notificationRequest('/api/notifications/read-all', 'PATCH')
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
      setNotificationError('')
    } catch (error) {
      setNotificationError(error.message)
    }
  }

  useEffect(() => {
    loadNotifications()
    if (!authUser) return undefined
    const timer = window.setInterval(loadNotifications, 30_000)
    return () => window.clearInterval(timer)
  }, [authUser?.id, demoMode])

  useEffect(() => {
    if (!accountMenuOpen) return undefined
    function closeOnOutsideClick(event) {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setAccountMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [accountMenuOpen])

  useEffect(() => () => {
    if (notificationCloseTimerRef.current) window.clearTimeout(notificationCloseTimerRef.current)
    if (notificationPulseTimerRef.current) window.clearTimeout(notificationPulseTimerRef.current)
  }, [])

  useEffect(() => {
    if (!notificationOpen) return undefined
    function closeOnOutsideClick(event) {
      if (!notificationWrapRef.current?.contains(event.target)) closeNotifications()
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') closeNotifications()
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [notificationOpen])

  useEffect(() => {
    if (!logoutConfirmOpen) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !logoutBusy) {
        setLogoutConfirmOpen(false)
        setLogoutError('')
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [logoutConfirmOpen, logoutBusy])

  const activeCount = requests.filter((request) => !['Completed', 'Cancelled'].includes(request.status)).length
  const completedCount = requests.filter((request) => request.status === 'Completed').length
  const unreadNotificationCount = notifications.filter((item) => !item.isRead).length
  useEffect(() => {
    if (unreadNotificationCount > previousUnreadCountRef.current) {
      setNotificationPulse(true)
      if (notificationPulseTimerRef.current) window.clearTimeout(notificationPulseTimerRef.current)
      notificationPulseTimerRef.current = window.setTimeout(() => {
        setNotificationPulse(false)
        notificationPulseTimerRef.current = null
      }, 900)
    }
    previousUnreadCountRef.current = unreadNotificationCount
  }, [unreadNotificationCount])

  const filteredRequests = useMemo(() => requests.filter((request) =>
    `${request.id} ${request.service} ${request.from} ${request.to}`.toLowerCase().includes(query.toLowerCase()),
  ), [requests, query])

  function createRequest(data) {
    const request = {
      ...data,
      id: `QH-${Math.floor(25000 + Math.random() * 74999)}`,
      date: 'Just now',
      status: 'Pending',
      rider: 'Finding a rider',
      initials: 'QH',
      color: 'orange',
    }
    setRequests((current) => [request, ...current])
    setPage('My requests')
    setModal(null)
    setNotice('Your request has been placed!')
    createNotification({
      title: data.kind === 'ride' ? 'Ride request submitted' : 'Errand request submitted',
      message: data.kind === 'ride'
        ? 'Your ride request was submitted and is waiting for a rider.'
        : 'Your errand request was submitted and is waiting for a rider.',
      type: data.kind === 'ride' ? 'ride' : 'errand',
      relatedRequestId: request.id,
    })
  }

  function updateStatus(id, status) {
    const request = requests.find((item) => item.id === id)
    setRequests((current) => current.map((item) => item.id === id ? { ...item, status } : item))
    setNotice(`Request updated to ${status.toLowerCase()}.`)
    if (request) {
      const updates = {
        Accepted: 'Your request has been accepted by a rider.',
        'Rider on the way': request.kind === 'ride' ? 'Your rider is on the way.' : 'Your delivery is on the way.',
        'In Progress': request.kind === 'ride' ? 'Your ride is now in progress.' : 'Your rider is processing your order.',
        'Shopping / Processing': 'Your rider is processing your order.',
        Delivered: 'Your delivery has been completed.',
        Completed: request.kind === 'ride' ? 'Your ride has been completed.' : 'Your delivery has been completed.',
        Cancelled: 'Your request was cancelled.',
      }
      createNotification({
        title: status === 'Completed' || status === 'Delivered' ? `${request.kind === 'ride' ? 'Ride' : 'Errand'} completed` : `${request.kind === 'ride' ? 'Ride' : 'Errand'} update`,
        message: updates[status] || `Your request status changed to ${status}.`,
        type: request.kind === 'ride' ? 'ride' : 'errand',
        relatedRequestId: request.id,
      })
    }
  }

  function openNotifications() {
    if (notificationCloseTimerRef.current) window.clearTimeout(notificationCloseTimerRef.current)
    setNotificationPanelMounted(true)
    setNotificationPanelClosing(false)
    setNotificationOpen(true)
    loadNotifications()
  }

  function closeNotifications() {
    if (!notificationPanelMounted || notificationPanelClosing) return
    setNotificationOpen(false)
    setNotificationPanelClosing(true)
    notificationCloseTimerRef.current = window.setTimeout(() => {
      setNotificationPanelMounted(false)
      setNotificationPanelClosing(false)
      notificationCloseTimerRef.current = null
    }, 270)
  }

  function toggleNotifications() {
    if (notificationOpen) closeNotifications()
    else openNotifications()
  }

  function openNotificationHistory() {
    setPage('Notifications')
    closeNotifications()
  }

  async function logout() {
    setLogoutBusy(true)
    setLogoutError('')
    try {
      if (demoMode) {
        await demoRequest('/api/auth/logout')
      } else {
        const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        if (!response.ok) throw new Error('The server could not end the session.')
      }
      setAuthUser(null)
      setRole('Customer')
      setPage('Overview')
      setLogoutConfirmOpen(false)
      setAccountMenuOpen(false)
      setAuthSuccessNotice('You have successfully logged out.')
    } catch (error) {
      setLogoutError(error.message)
    } finally {
      setLogoutBusy(false)
    }
  }

  function showLogoutConfirmation() {
    setAccountMenuOpen(false)
    setLogoutError('')
    setLogoutConfirmOpen(true)
  }

  function navigateFromAccountMenu(nextPage) {
    setPage(nextPage)
    setAccountMenuOpen(false)
  }

  async function updateProfile(data) {
    if (demoMode) {
      const result = await demoRequest('/api/auth/profile', data)
      setAuthUser(result.user)
      setNotice(result.message)
      await loadNotifications()
      return
    }
    const response = await fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(result.error || 'Could not update your profile.')
      error.fields = result.fields || {}
      throw error
    }
    setAuthUser(result.user)
    setNotice(result.message)
    await loadNotifications()
  }

  async function selectNotification(notification) {
    if (!notification.isRead) await markNotificationRead(notification.id)
    openNotificationHistory()
  }

  function onAuthenticated(user, message) {
    setAuthUser(user)
    setRole(user.role === 'admin' ? 'Admin' : user.role === 'rider' ? 'Rider' : 'Customer')
    setAuthServiceError('')
    setPage('Overview')
    setNotice(message || 'Signed in successfully.')
  }

  if (authChecking) return <div className="auth-loading"><span className="auth-spinner" /> Loading your QuickHatid account...</div>
  if (!authUser) return <AuthPage key={authServiceError} onAuthenticated={onAuthenticated} serviceError={authServiceError} successNotice={authSuccessNotice} demoMode={demoMode} />

  const title = role === 'Customer' ? page : `${role} ${page === 'Overview' ? 'dashboard' : page.toLowerCase()}`

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage('Overview'); setMenuOpen(false) }}>
          <span className="brand-mark"><Zap size={21} fill="currentColor" /></span>
          <span>quick<span className="brand-orange">hatid</span><small>YOUR LOCAL SERVICE, ON THE WAY</small></span>
        </a>
        <div className="sidebar-location"><span className="location-icon"><MapPin size={16} /></span><span><small>YOUR LOCATION</small><strong>Don Carlos, Bukidnon</strong></span><ChevronDown size={15} /></div>
        <div className="nav-heading">MENU</div>
        <nav className="main-nav">
          {navItems.map(({ label, icon: Icon, page: navPage, badge, count }) => (
            <button key={navPage} className={`nav-link ${page === navPage ? 'selected' : ''}`} onClick={() => { setPage(navPage); setMenuOpen(false) }}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
              {badge && <em>{badge}</em>}{count && <small className="nav-count">{activeCount || count}</small>}
            </button>
          ))}
        </nav>
        <div className="nav-heading tools-heading">YOUR ACCOUNT</div>
        <nav className="main-nav">
          <button className={`nav-link ${page === 'Notifications' ? 'selected' : ''}`} onClick={() => { setPage('Notifications'); setMenuOpen(false) }}><Bell size={18} /><span>Notifications</span>{unreadNotificationCount > 0 && <small className="nav-count">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</small>}</button>
          <button className={`nav-link ${page === 'Profile' ? 'selected' : ''}`} onClick={() => { setPage('Profile'); setMenuOpen(false) }}><UserRound size={18} /><span>My profile</span></button>
        </nav>
        <div className="sidebar-promo">
          <div className="promo-icon"><Headphones size={20} /></div>
          <strong>Need a hand?</strong>
          <p>Our local support team is just a message away.</p>
          <button onClick={() => setNotice('Support: hello@quickhatid.ph · (088) 123-4567')}>Get help <ArrowRight size={14} /></button>
          <div className="promo-orb" />
        </div>
        <div className="sidebar-footer">
          <UserAvatar user={authUser} />
          <div className="user-meta"><strong>{authUser.fullName || 'Welcome!'}</strong><small>{role} account</small></div>
          <button className="icon-btn more-btn" aria-label="Log out" title="Log out" onClick={showLogoutConfirmation}><MoreHorizontal size={20} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-btn" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>Pages</span><ChevronRight size={14} /><strong>{title}</strong></div>
          <HeaderDateTime />
          <div className="topbar-actions">
            <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search anything..." /><kbd>⌘ K</kbd></label>
            <div className="notification-bell-wrap" ref={notificationWrapRef}>
              <button
                className={`icon-btn top-bell ${unreadNotificationCount ? 'has-unread' : ''} ${notificationPulse ? 'notification-arrived' : ''}`}
                aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}
                aria-haspopup="dialog"
                aria-expanded={notificationOpen}
                onClick={toggleNotifications}
              >
                <Bell size={19} />
                {unreadNotificationCount > 0 && <span className="notification-count" aria-label={`${unreadNotificationCount} unread notifications`}>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}
              </button>
              {notificationPanelMounted && <NotificationDropdown
                notifications={notifications}
                unreadCount={unreadNotificationCount}
                error={notificationError}
                closing={notificationPanelClosing}
                onClose={closeNotifications}
                onMarkAllRead={markAllNotificationsRead}
                onSelect={selectNotification}
                onViewHistory={openNotificationHistory}
              />}
            </div>
            <div className="top-divider" />
            <div className="account-menu-wrap" ref={accountMenuRef}>
              <button
                className={`role-picker ${accountMenuOpen ? 'account-menu-trigger-open' : ''}`}
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label="Open account menu"
              >
                <UserAvatar user={authUser} />
                <span><strong>{authUser.fullName || 'Welcome!'}</strong><small>{role} account</small></span>
                <ChevronDown size={15} className="account-menu-chevron" />
              </button>
              {accountMenuOpen && <div className="account-dropdown" role="menu">
                <div className="account-dropdown-heading"><strong>{authUser.fullName || 'QuickHatid account'}</strong><span>{authUser.username ? `@${authUser.username} · ` : ''}{authUser.email}</span></div>
                <button role="menuitem" onClick={() => navigateFromAccountMenu('Profile')}><UserRound size={16} /><span>My Profile</span></button>
                <button role="menuitem" onClick={() => navigateFromAccountMenu('Account Settings')}><Settings size={16} /><span>Account Settings</span></button>
                <button role="menuitem" onClick={() => navigateFromAccountMenu('Transactions')}><CreditCard size={16} /><span>Transaction History</span></button>
                <div className="account-dropdown-divider" />
                <button className="account-logout-item" role="menuitem" onClick={showLogoutConfirmation}><LogOut size={16} /><span>Logout</span></button>
              </div>}
            </div>
          </div>
        </header>

        <div className="content">
          {demoMode && <div className="exhibition-banner"><ShieldCheck size={14} /><span><strong>Exhibition mode</strong> · Accounts save in this browser only.</span><button onClick={() => setNotice('To connect MySQL later, set VITE_AUTH_MODE=mysql and configure the server environment.')}>About this demo</button></div>}
          {page === 'Overview' && <Overview requests={filteredRequests} activeCount={activeCount} completedCount={completedCount} onBook={(kind) => setPage(kind === 'errand' ? 'Errand delivery' : 'Book a ride')} onNavigate={setPage} onStatus={updateStatus} role={role} setRole={setRole} user={authUser} />}
          {page === 'Book a ride' && <BookingPage kind="ride" onBook={createRequest} onBack={() => setPage('Overview')} />}
          {page === 'Errand delivery' && <ErrandDeliveryPage onBook={createRequest} onBack={() => setPage('Overview')} />}
          {page === 'My requests' && <RequestsPage requests={filteredRequests} onStatus={updateStatus} onBook={() => setModal('ride')} />}
          {page === 'Transactions' && <TransactionsPage requests={filteredRequests} />}
          {page === 'Notifications' && <NotificationsPage notifications={notifications} error={notificationError} onMarkRead={markNotificationRead} onMarkAllRead={markAllNotificationsRead} onNavigate={setPage} />}
          {(page === 'Profile' || page === 'Account Settings') && <ProfilePage role={role} onLogout={showLogoutConfirmation} onSaveProfile={updateProfile} onNotificationsChanged={loadNotifications} user={authUser} demoMode={demoMode} heading={page === 'Account Settings' ? 'Account settings' : 'My profile'} />}
          {page === 'About Us' && <AboutUs onBack={() => setPage('Overview')} />}
        </div>
      </main>
      {menuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
      {modal && <RequestModal kind={modal} onClose={() => setModal(null)} onSubmit={createRequest} />}
      {logoutConfirmOpen && <div className="logout-modal-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !logoutBusy) {
          setLogoutConfirmOpen(false)
          setLogoutError('')
        }
      }}>
        <section className="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-modal-title" aria-describedby="logout-modal-message">
          <span className="logout-modal-icon"><LogOut size={23} /></span>
          <h2 id="logout-modal-title">Confirm Logout</h2>
          <p id="logout-modal-message">Are you sure you want to log out of your QuickHatid account?</p>
          {logoutError && <p className="logout-modal-error" role="alert">{logoutError}</p>}
          <div className="logout-modal-actions">
            <button className="logout-confirm-button" onClick={logout} disabled={logoutBusy}>{logoutBusy ? 'Logging out...' : 'YES – Log Out'}</button>
            <button className="logout-cancel-button" onClick={() => { setLogoutConfirmOpen(false); setLogoutError('') }} disabled={logoutBusy}>NO – Cancel</button>
          </div>
        </section>
      </div>}
      {notice && <div className="toast"><span><Check size={16} /></span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>
  )
}

function Overview({ requests, activeCount, completedCount, onBook, onNavigate, onStatus, role, setRole, user }) {
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const activeRequest = requests.find((request) => !['Completed', 'Cancelled'].includes(request.status))

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const hour = currentTime.getHours()
  const greeting = hour >= 5 && hour < 12
    ? 'Good Morning'
    : hour >= 12 && hour < 18
      ? 'Good Afternoon'
      : 'Good Evening'
  const fullName = String(user?.fullName || '').trim()
  const firstName = fullName.split(/\s+/)[0]
  const displayName = firstName
    ? `${firstName.charAt(0).toLocaleUpperCase()}${firstName.slice(1).toLocaleLowerCase()}`
    : ''

  return (
    <>
    <div className="welcome-row">
      <div><p className="eyebrow">{role === 'Customer' ? 'QUICKHATID MARKETPLACE' : 'YOUR QUICKHATID ACCOUNT'}</p><h1>{displayName ? `${greeting}, ${displayName}!` : 'Welcome!'} <span className="wave">✦</span></h1><p className="welcome-sub">{role === 'Customer' ? 'What can we help you with today?' : 'Here’s what’s happening across your account today.'}</p></div>
        <button className="outline-button" onClick={() => onNavigate('My requests')}><CalendarDays size={16} /> View activity <ChevronDown size={15} /></button>
      </div>

      {role === 'Customer' ? (
        <section className="hero-banner">
          <div className="hero-copy"><span className="hero-kicker"><span /> YOUR TOWN, A LITTLE CLOSER</span><h2>Your ride and errands,<br />just <span>one click away.</span></h2><p>Quick, convenient, and reliable service from<br className="desktop-break" /> your neighbors in Don Carlos.</p><div className="hero-buttons"><button className="hero-primary" onClick={() => onBook('ride')}>Book a ride <ArrowRight size={16} /></button><button className="hero-secondary" onClick={() => onBook('errand')}>Request an errand</button></div><div className="hero-trust"><div className="trust-avatars"><span>JR</span><span>MS</span><span>+2k</span></div><span><strong>Local riders, real neighbors</strong><small>Here for you, every day</small></span><span className="trust-star"><Star size={15} fill="currentColor" /> 4.9</span></div></div>
          <div className="hero-art" aria-hidden="true"><div className="sun-shape" /><div className="hero-route"><span><MapPin size={15} fill="currentColor" /></span><i /><span><MapPin size={15} fill="currentColor" /></span></div><div className="hero-card"><span className="mini-bike"><Bike size={23} /></span><span><strong>Your rider is nearby</strong><small>Usually arrives in 5–10 min</small></span><span className="online-dot" /></div><div className="hero-delivery"><span>✦</span> Around the corner, on the way</div><div className="rider-illustration"><div className="rider-helmet" /><div className="rider-head" /><div className="rider-body" /><div className="rider-arm" /><div className="delivery-box">QH</div><div className="bike-wheel wheel-left" /><div className="bike-wheel wheel-right" /><div className="bike-frame" /><div className="bike-handle" /><div className="road-line" /></div><span className="art-spark spark-one">✦</span><span className="art-spark spark-two">✳</span></div>
          <div className="hero-bottom"><span><ShieldCheck size={15} /> Verified local riders</span><i /><span><Clock3 size={15} /> Available 7 days a week</span><i /><span><Heart size={15} /> Made for Don Carlos</span></div>
        </section>
      ) : <RoleOverview role={role} setRole={setRole} onBook={onBook} />}

      <section className="stats-row">
        <StatCard label="Total requests" value={String(requests.length).padStart(2, '0')} icon={PackageOpen} tone="soft-orange" change="+2 this month" up />
        <StatCard label="In progress" value={String(activeCount).padStart(2, '0')} icon={Clock3} tone="soft-blue" detail="Requests on the way" />
        <StatCard label="Completed" value={String(completedCount).padStart(2, '0')} icon={PackageCheck} tone="soft-green" change="Looking good!" up />
        <StatCard label="Total spent" value={`₱${requests.reduce((sum, item) => sum + item.fee, 0).toLocaleString()}`} icon={Wallet} tone="soft-purple" detail="Across all requests" />
      </section>

      <section className="service-section">
        <div className="section-heading"><div><p className="eyebrow">YOUR LOCAL FAVORITES</p><h2>How can we help?</h2></div><button className="text-button" onClick={() => onNavigate('Errand delivery')}>Explore all services <ArrowRight size={15} /></button></div>
        <div className="service-grid">{services.map((service) => <ServiceCard key={service.title} service={service} onClick={() => onBook(service.kind)} />)}</div>
      </section>

      <section className="lower-grid">
        <div className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h2>Recent requests</h2></div><button className="text-button" onClick={() => onNavigate('My requests')}>See all <ArrowRight size={15} /></button></div>{activeRequest && <div className="active-callout"><span className="live-pulse"><span /></span><div><strong>{activeRequest.status === 'Pending' ? 'Finding you a rider' : `${activeRequest.rider} is on the way`}</strong><small>{activeRequest.service} · {activeRequest.from}</small></div><button aria-label="Open request" onClick={() => onNavigate('My requests')}><ArrowRight size={16} /></button></div>}<div className="mini-request-list">{requests.slice(0, 3).map((request) => <RequestRow key={request.id} request={request} onStatus={onStatus} compact />)}</div></div>
        <div className="panel tip-panel"><div className="tip-header"><span className="tip-icon"><Star size={18} fill="currentColor" /></span><span className="eyebrow">A LITTLE LOCAL LOVE</span></div><h3>Good neighbors<br />make the best riders.</h3><p>Every QuickHatid rider is from our community. Leave a rating after your trip to support the people who keep Don Carlos moving.</p><div className="rating-display"><span>★★★★★</span><small>4.9 average local rating</small></div><button className="tip-link" onClick={() => onNavigate('Transactions')}>View your past trips <ArrowRight size={14} /></button><span className="tip-decoration">✳</span></div>
      </section>
      <footer className="page-footer"><span>© 2026 QuickHatid</span><span>Made with <Heart size={12} fill="currentColor" /> in Don Carlos, Bukidnon</span><button onClick={() => onNavigate('Profile')}>Need help? <CircleHelp size={13} /></button></footer>
    </>
  )
}

function StatCard({ label, value, icon: Icon, tone, change, up, detail }) {
  return <div className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={18} /></span><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-foot">{change ? <><b className={up ? 'positive' : ''}>{change}</b><span> vs last month</span></> : detail}</span><span className="stat-chart"><i style={{ height: '34%' }} /><i style={{ height: '52%' }} /><i style={{ height: '42%' }} /><i style={{ height: '71%' }} /><i style={{ height: '58%' }} /><i style={{ height: '90%' }} /><i style={{ height: '68%' }} /><i style={{ height: '100%' }} /></span></div>
}

function ServiceCard({ service, onClick }) {
  const Icon = service.icon
  return <button className="service-card" onClick={onClick}><div className={`service-illustration ${service.tone}`}><Icon size={28} strokeWidth={1.7} /><span className="service-orbit" /></div><div className="service-card-info"><div><strong>{service.title}</strong><small>{service.description}</small><span className="service-fee">{service.fee}</span></div><span className="service-arrow"><ArrowUpRight size={17} /></span></div></button>
}

function RequestRow({ request, onStatus, compact = false }) {
  const canCancel = !['Completed', 'Cancelled'].includes(request.status)
  return <div className={`request-row ${compact ? 'compact-row' : ''}`}><span className={`request-icon ${request.kind}`}><RequestIcon kind={request.kind} /></span><span className="request-info"><strong>{request.service}</strong><small>{request.id} <i /> {request.date}</small></span><span className="request-route"><MapPin size={13} />{request.from}<ArrowRight size={12} />{request.to}</span><span className="request-fee">₱{request.fee}</span><Status>{request.status}</Status><button className="row-more" aria-label={canCancel ? `Cancel request ${request.id}` : `No actions for ${request.id}`} title={canCancel ? 'Cancel request' : request.status} disabled={!canCancel} onClick={() => onStatus && onStatus(request.id, 'Cancelled')}><MoreHorizontal size={19} /></button></div>
}

function RequestIcon({ kind }) { return kind === 'ride' ? <Bike size={17} /> : <ShoppingBag size={16} /> }

function RequestsPage({ requests, onStatus, onBook }) {
  const [filter, setFilter] = useState('All requests')
  const activeRequests = requests.filter((request) => !['Completed', 'Cancelled'].includes(request.status))
  const visibleRequests = filter === 'In progress' ? activeRequests : filter === 'Completed' ? requests.filter((request) => request.status === 'Completed') : filter === 'Cancelled' ? requests.filter((request) => request.status === 'Cancelled') : requests
  const filters = [
    ['All requests', requests.length],
    ['In progress', activeRequests.length],
    ['Completed', requests.filter((request) => request.status === 'Completed').length],
    ['Cancelled', requests.filter((request) => request.status === 'Cancelled').length],
  ]
  return <div className="subpage"><div className="subpage-header"><div><p className="eyebrow">YOUR QUICKHATID ACTIVITY</p><h1>My requests</h1><p>Keep track of your rides and errands, all in one place.</p></div><button className="primary-button" onClick={onBook}><Plus size={17} /> New request</button></div><div className="filter-tabs">{filters.map(([label, count]) => <button key={label} className={filter === label ? 'tab-active' : ''} onClick={() => setFilter(label)}>{label}{label === 'All requests' && <span>{count}</span>}</button>)}<div className="filter-spacer" /><button className="filter-button" onClick={() => setFilter('All requests')}><ArrowLeftRight size={15} /> Reset <ChevronDown size={14} /></button></div><div className="panel request-table"><div className="table-header"><span>REQUEST</span><span>ROUTE</span><span>FEE</span><span>STATUS</span><span /></div>{visibleRequests.length ? visibleRequests.map((request) => <RequestRow key={request.id} request={request} onStatus={onStatus} />) : <EmptyState title="No requests found" text="Try another search or start a new request." />}</div><div className="request-help"><span className="help-round"><Headphones size={18} /></span><span><strong>Need help with a request?</strong><small>Our team is right here if you need anything.</small></span><button onClick={() => window.alert('Contact QuickHatid support at hello@quickhatid.ph')}>Contact support <ArrowRight size={14} /></button></div></div>
}

function TransactionsPage({ requests }) {
  return <div className="subpage"><div className="subpage-header"><div><p className="eyebrow">YOUR SPENDING, AT A GLANCE</p><h1>Transactions</h1><p>A simple record of every service you’ve used with us.</p></div><button className="outline-button" onClick={() => window.print()}><FileText size={16} /> Export history</button></div><div className="transaction-stats"><div><span>Total spent</span><strong>₱{requests.reduce((sum, item) => sum + item.fee, 0).toLocaleString()}</strong><small>Across {requests.length} requests</small></div><div><span>Cash payments</span><strong>{requests.length}</strong><small>Pay your rider directly</small></div><div><span>Completed</span><strong>{requests.filter((request) => request.status === 'Completed').length}</strong><small>Thank you for choosing local</small></div></div><div className="panel request-table"><div className="table-header transaction-table-header"><span>TRANSACTION</span><span>SERVICE & DATE</span><span>RIDER</span><span>AMOUNT</span><span>STATUS</span></div>{requests.map((request) => <div className="request-row transaction-row" key={request.id}><span className="transaction-id"><strong>{request.id}</strong><small><CreditCard size={12} /> Cash</small></span><span className="request-info"><strong>{request.service}</strong><small>{request.date}</small></span><span className="rider-cell"><span className={`avatar avatar-${request.color}`}>{request.initials}</span>{request.rider}</span><span className="request-fee">₱{request.fee}</span><Status>{request.status}</Status></div>)}</div><p className="cash-note"><Wallet size={16} /> QuickHatid uses cash payments for now. Pay your rider directly when the service is complete.</p></div>
}

function RideBookingPage({ onBook, onBack }) {
  const [service, setService] = useState('Motorcycle ride')
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [instructions, setInstructions] = useState('')
  const rideOptions = [
    { name: 'Motorcycle ride', detail: 'Quick and convenient for one or two people', fee: 50, icon: Bike, tag: 'QUICK PICK' },
    { name: 'Point-to-point travel', detail: 'A comfortable trip to a farther destination', fee: 80, icon: Truck, tag: 'LONGER TRIP' },
  ]
  const selectedRide = rideOptions.find((option) => option.name === service) || rideOptions[0]
  const SelectedRideIcon = selectedRide.icon

  function submitRide(event) {
    event.preventDefault()
    onBook({
      service,
      kind: 'ride',
      from: pickup.trim(),
      to: destination.trim(),
      fee: selectedRide.fee,
      details: '',
      instructions: instructions.trim(),
    })
  }

  return (
    <div className="subpage ride-booking-page">
      <button className="ride-back-link" onClick={onBack}><ArrowDownLeft size={15} /> Back to overview</button>
      <section className="ride-booking-hero">
        <div className="ride-hero-orb ride-hero-orb-one" />
        <div className="ride-hero-orb ride-hero-orb-two" />
        <span className="ride-hero-icon"><Bike size={24} /></span>
        <div className="ride-hero-copy">
          <span className="ride-hero-kicker"><i /> LOCAL RIDES, MADE SIMPLE</span>
          <h1>Where would you like to go?</h1>
          <p>Choose your ride, add two locations, and you’re ready to request a local rider.</p>
        </div>
        <div className="ride-stepper" aria-label="Booking steps">
          <span className="ride-step-active"><i>1</i> Choose ride</span><b />
          <span><i>2</i> Trip details</span><b />
          <span><i>3</i> Confirm</span>
        </div>
      </section>

      <form className="ride-booking-layout" onSubmit={submitRide}>
        <div className="ride-booking-main">
          <section className="ride-form-card">
            <header className="ride-section-heading">
              <span className="ride-section-number">01</span>
              <div><h2>Choose your ride</h2><p>Select the ride that best fits your trip.</p></div>
            </header>
            <div className="ride-choice-list">
              {rideOptions.map(({ name, detail, fee, icon: Icon, tag }) => (
                <button
                  type="button"
                  key={name}
                  className={`ride-choice-card ${service === name ? 'ride-choice-selected' : ''}`}
                  onClick={() => setService(name)}
                  aria-pressed={service === name}
                >
                  <span className="ride-choice-icon"><Icon size={21} /></span>
                  <span className="ride-choice-copy"><strong>{name}</strong><small>{detail}</small></span>
                  <span className="ride-choice-price"><small>{tag}</small><strong>From ₱{fee}</strong></span>
                  <span className="ride-choice-radio" aria-hidden="true"><i /></span>
                </button>
              ))}
            </div>
          </section>

          <section className="ride-form-card">
            <header className="ride-section-heading">
              <span className="ride-section-number">02</span>
              <div><h2>Your trip details</h2><p>Use a street, barangay, business, or nearby landmark.</p></div>
            </header>
            <div className="ride-location-fields">
              <label className="ride-location-field">
                <span className="ride-field-label">Pickup location <b>Required</b></span>
                <span className="ride-input-shell"><span className="ride-location-marker pickup-marker"><MapPin size={17} /></span><input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Where should your rider meet you?" autoComplete="street-address" required maxLength={180} /></span>
              </label>
              <div className="ride-route-connector" aria-hidden="true"><i /><i /><i /></div>
              <label className="ride-location-field">
                <span className="ride-field-label">Destination <b>Required</b></span>
                <span className="ride-input-shell"><span className="ride-location-marker destination-marker"><MapPin size={17} /></span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Where are you going?" autoComplete="off" required maxLength={180} /></span>
              </label>
            </div>
            <label className="ride-instructions-field">
              <span className="ride-field-label">Note for your rider <small>Optional</small></span>
              <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="e.g. I’ll be waiting by the main entrance." rows={3} maxLength={300} />
              <small className="ride-character-count">{instructions.length}/300</small>
            </label>
          </section>
          <div className="ride-assurance"><ShieldCheck size={17} /><span><strong>Every ride starts with a verified local rider.</strong><small>Your request will be sent to available riders near you.</small></span></div>
        </div>

        <aside className="ride-summary-card">
          <div className="ride-summary-heading"><span><Check size={16} /><b>TRIP SUMMARY</b></span><small>Review before you book</small></div>
          <div className="ride-summary-route">
            <div className="ride-summary-stop"><span className="summary-stop-dot pickup-dot" /><span><small>PICKUP</small><strong>{pickup.trim() || 'Add your pickup location'}</strong></span></div>
            <div className="ride-summary-route-line" />
            <div className="ride-summary-stop"><span className="summary-stop-dot destination-dot" /><span><small>DESTINATION</small><strong>{destination.trim() || 'Add your destination'}</strong></span></div>
          </div>
          <div className="ride-summary-service"><span className="ride-summary-service-icon"><SelectedRideIcon size={18} /></span><span><small>YOUR RIDE</small><strong>{selectedRide.name}</strong></span></div>
          <div className="ride-summary-cost"><span>Estimated service fee</span><strong>₱{selectedRide.fee}.00</strong></div>
          <div className="ride-summary-payment"><Wallet size={15} /><span><strong>Cash payment</strong><small>Pay your rider when your trip is complete.</small></span></div>
          <button type="submit" className="ride-submit-button">Confirm ride request <ArrowRight size={17} /></button>
          <p className="ride-summary-footnote"><ShieldCheck size={13} /> No payment required to request a ride.</p>
        </aside>
      </form>
    </div>
  )
}

function BookingPage({ kind, onBook, onBack }) {
  if (kind === 'ride') return <RideBookingPage onBook={onBook} onBack={onBack} />

  const ride = kind === 'ride'
  const Icon = ride ? Bike : ShoppingBasket
  return <div className="subpage"><button className="back-link" onClick={onBack}><ArrowDownLeft size={15} /> Back to overview</button><div className="booking-layout"><div><div className="booking-intro"><span className={`big-service-icon ${ride ? 'orange' : 'green'}`}><Icon size={27} /></span><p className="eyebrow">{ride ? 'RIDE BOOKING' : 'ERRAND DELIVERY'}</p><h1>{ride ? 'Where to next?' : 'Your to-do, taken care of.'}</h1><p>{ride ? 'A friendly local rider is just around the corner.' : 'Tell us what you need, and a local rider will handle the rest.'}</p></div><div className="booking-option-list">{(ride ? [['Motorcycle ride', 'Quick and convenient for one or two people', 'From ₱50', Bike], ['Point-to-point travel', 'A little farther? We’ll take you there.', 'From ₱80', Truck]] : [['Grocery shopping', 'We’ll shop your list and bring it over.', 'From ₱80', ShoppingBasket], ['Food & parcel pickup', 'Pickup from a local store or restaurant.', 'From ₱60', ShoppingBag], ['Medicine pickup', 'Pharmacy essentials delivered with care.', 'From ₱70', Heart], ['Documents & more', 'Small deliveries and everyday errands.', 'From ₱65', BriefcaseBusiness]]).map(([name, desc, fee, OptionIcon], index) => <button key={name} className={`booking-option ${index === 0 ? 'option-active' : ''}`} onClick={(event) => { event.currentTarget.parentElement.querySelectorAll('.booking-option').forEach((item) => item.classList.remove('option-active')); event.currentTarget.classList.add('option-active') }}><span className="option-icon"><OptionIcon size={18} /></span><span><strong>{name}</strong><small>{desc}</small></span><b>{fee}</b><span className="radio-dot" /></button>)}</div><button className="primary-button booking-cta" onClick={onBook}>{ride ? 'Set up your ride' : 'Plan your errand'} <ArrowRight size={17} /></button></div><aside className="panel booking-aside"><div className="aside-map"><div className="map-street street-a" /><div className="map-street street-b" /><div className="map-street street-c" /><div className="map-block block-a" /><div className="map-block block-b" /><div className="map-block block-c" /><div className="map-block block-d" /><span className="map-pin pin-a"><MapPin size={20} fill="currentColor" /></span><span className="map-pin pin-b"><MapPin size={20} fill="currentColor" /></span><div className="map-label">DON CARLOS, BUKIDNON</div></div><div className="aside-content"><span className="eyebrow">YOUR LOCAL SERVICE, ON THE WAY</span><h3>{ride ? 'The town’s closer than you think.' : 'The little things, handled.'}</h3><p>From Poblacion to the neighboring barangays, our community riders know the roads — and the people — best.</p><div className="aside-detail"><ShieldCheck size={16} /><span><strong>Rider-verified</strong><small>Every active rider is approved by our team.</small></span></div><div className="aside-detail"><Clock3 size={16} /><span><strong>Available 7 days</strong><small>Requests are open every day of the week.</small></span></div><div className="aside-detail"><Wallet size={16} /><span><strong>Simple, upfront fees</strong><small>Pay your rider in cash when complete.</small></span></div></div></aside></div></div>
}

function ErrandDeliveryPage({ onBook, onBack }) {
  const [service, setService] = useState('Grocery shopping')
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [details, setDetails] = useState('')
  const [instructions, setInstructions] = useState('')
  const services = [
    { name: 'Grocery shopping', description: 'We shop your list and deliver it to you.', fee: 80, icon: ShoppingBasket },
    { name: 'Food pickup', description: 'Pick up a meal from your favorite local spot.', fee: 60, icon: ShoppingBag },
    { name: 'Medicine pickup', description: 'Pharmacy essentials delivered with care.', fee: 70, icon: Heart },
    { name: 'Document delivery', description: 'Send documents and small items locally.', fee: 65, icon: FileText },
    { name: 'Other personal errand', description: 'A little help with another local task.', fee: 65, icon: BriefcaseBusiness },
  ]
  const selectedService = services.find((item) => item.name === service) || services[0]
  const SelectedServiceIcon = selectedService.icon

  function submitErrand(event) {
    event.preventDefault()
    onBook({
      service,
      kind: 'errand',
      from: pickup.trim(),
      to: destination.trim(),
      fee: selectedService.fee,
      details: details.trim(),
      instructions: instructions.trim(),
    })
  }

  return (
    <div className="subpage errand-page">
      <button className="errand-back-link" onClick={onBack}><ArrowDownLeft size={15} /> Back to overview</button>
      <section className="errand-hero">
        <div className="errand-hero-orb errand-hero-orb-one" />
        <div className="errand-hero-orb errand-hero-orb-two" />
        <span className="errand-hero-icon"><PackageOpen size={24} /></span>
        <div className="errand-hero-copy">
          <span className="errand-hero-kicker"><i /> LOCAL HELP, ON THE WAY</span>
          <h1>Your to-do, taken care of.</h1>
          <p>Tell us what you need picked up or done. A verified local rider will take it from here.</p>
        </div>
        <div className="errand-hero-note"><ShieldCheck size={16} /><span><strong>Handled by a local</strong><small>Rider-verified service</small></span></div>
      </section>

      <form className="errand-layout" onSubmit={submitErrand}>
        <div className="errand-main">
          <section className="errand-form-card">
            <header className="errand-section-heading">
              <span className="errand-section-number">01</span>
              <div><h2>What can we help with?</h2><p>Choose the errand that best matches your request.</p></div>
            </header>
            <div className="errand-service-grid">
              {services.map(({ name, description, fee, icon: Icon }) => (
                <button
                  type="button"
                  key={name}
                  className={`errand-service-card ${service === name ? 'errand-service-selected' : ''}`}
                  onClick={() => setService(name)}
                  aria-pressed={service === name}
                >
                  <span className="errand-service-icon"><Icon size={19} /></span>
                  <span className="errand-service-copy"><strong>{name}</strong><small>{description}</small><b>From ₱{fee}</b></span>
                  <span className="errand-service-radio" aria-hidden="true"><i /></span>
                </button>
              ))}
            </div>
          </section>

          <section className="errand-form-card">
            <header className="errand-section-heading">
              <span className="errand-section-number">02</span>
              <div><h2>Where should we go?</h2><p>Add clear pickup and drop-off details to help your rider.</p></div>
            </header>
            <div className="errand-location-fields">
              <label className="errand-field">
                <span className="errand-field-label"><Store size={14} /> Store or pickup location <b>Required</b></span>
                <span className="errand-input-shell"><MapPin size={17} /><input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Store name, address, or landmark" autoComplete="off" required maxLength={180} /></span>
              </label>
              <div className="errand-route-connector" aria-hidden="true"><i /><i /><i /></div>
              <label className="errand-field">
                <span className="errand-field-label"><MapPin size={14} /> Delivery address <b>Required</b></span>
                <span className="errand-input-shell"><MapPin size={17} /><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Barangay, street, or nearby landmark" autoComplete="street-address" required maxLength={180} /></span>
              </label>
            </div>
          </section>

          <section className="errand-form-card">
            <header className="errand-section-heading">
              <span className="errand-section-number">03</span>
              <div><h2>Share the details</h2><p>Include items, quantities, or anything your rider should know.</p></div>
            </header>
            <label className="errand-textarea-field">
              <span className="errand-field-label">Errand details <b>Required</b></span>
              <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder={service === 'Grocery shopping' ? 'e.g. 1 kg rice, eggs (1 dozen), and cooking oil (small bottle)' : 'Describe the item or task you need help with.'} rows={4} required maxLength={600} />
              <small>{details.length}/600</small>
            </label>
            <label className="errand-textarea-field errand-instructions">
              <span className="errand-field-label">Special instructions <span>Optional</span></span>
              <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Gate code, preferred brand, or delivery notes..." rows={3} maxLength={300} />
              <small>{instructions.length}/300</small>
            </label>
          </section>
          <div className="errand-assurance"><ShieldCheck size={17} /><span><strong>Your request goes to verified local riders.</strong><small>You can follow its status from My requests.</small></span></div>
        </div>

        <aside className="errand-summary-card">
          <div className="errand-summary-heading"><span><ShoppingBag size={16} /><b>REQUEST SUMMARY</b></span><small>Review your errand</small></div>
          <div className="errand-summary-route">
            <div className="errand-summary-stop"><span className="errand-stop-dot errand-pickup-dot" /><span><small>PICKUP</small><strong>{pickup.trim() || 'Add a store or pickup location'}</strong></span></div>
            <div className="errand-summary-route-line" />
            <div className="errand-summary-stop"><span className="errand-stop-dot errand-dropoff-dot" /><span><small>DELIVER TO</small><strong>{destination.trim() || 'Add a delivery address'}</strong></span></div>
          </div>
          <div className="errand-summary-service"><span className="errand-summary-icon"><SelectedServiceIcon size={18} /></span><span><small>SELECTED SERVICE</small><strong>{selectedService.name}</strong></span></div>
          <div className="errand-summary-detail"><span>Request details</span><p>{details.trim() || 'Your item list or errand description will appear here.'}</p></div>
          <div className="errand-summary-cost"><span>Estimated service fee</span><strong>₱{selectedService.fee}.00</strong></div>
          <div className="errand-summary-payment"><Wallet size={15} /><span><strong>Cash payment</strong><small>Pay the rider when your errand is complete.</small></span></div>
          <button type="submit" className="errand-submit-button">Submit errand request <ArrowRight size={17} /></button>
          <p className="errand-summary-footnote"><Info size={13} /> Item costs are separate from the service fee.</p>
        </aside>
      </form>
    </div>
  )
}

function NotificationIcon({ type }) {
  const Icon = type === 'ride' ? Bike : type === 'errand' ? PackageOpen : type === 'account' ? ShieldCheck : Bell
  const tone = type === 'ride' ? 'soft-orange' : type === 'errand' ? 'soft-green' : type === 'account' ? 'soft-blue' : 'soft-yellow'
  return <span className={`stat-icon ${tone}`}><Icon size={18} /></span>
}

function notificationDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

function NotificationDropdown({ notifications, unreadCount, error, closing, onClose, onMarkAllRead, onSelect, onViewHistory }) {
  return (
    <section className={`notification-panel ${closing ? 'notification-panel-closing' : 'notification-panel-open'}`} role="dialog" aria-label="Notifications">
      <header className="notification-panel-header">
        <div><h2>Notifications</h2><span>{unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}</span></div>
        <button className="notification-close" aria-label="Close notifications" onClick={onClose}><X size={17} /></button>
      </header>
      {unreadCount > 0 && <button className="notification-mark-all" onClick={onMarkAllRead}>Mark All as Read</button>}
      {error && <p className="notification-error" role="alert">{error}</p>}
      <div className="notification-panel-list">
        {notifications.length ? notifications.slice(0, 6).map((notification) => (
          <button className={`notification-entry ${notification.isRead ? '' : 'notification-entry-unread'}`} key={notification.id} onClick={() => onSelect(notification)}>
            <NotificationIcon type={notification.type} />
            <span className="notification-entry-copy"><strong>{notification.title}</strong><span>{notification.message}</span><time dateTime={notification.createdAt}>{notificationDate(notification.createdAt)}</time></span>
            {!notification.isRead && <i className="notification-unread-dot" aria-label="Unread" />}
          </button>
        )) : !error ? <div className="notification-empty"><span><Bell size={20} /></span><strong>No notifications yet</strong><small>Updates about your rides, errands, and account will appear here.</small></div> : null}
      </div>
      <button className="notification-history-link" onClick={onViewHistory}>View notification history <ArrowRight size={14} /></button>
    </section>
  )
}

function NotificationsPage({ notifications, error, onMarkRead, onMarkAllRead, onNavigate }) {
  return (
    <div className="subpage notification-history-page">
      <div className="subpage-header">
        <div><p className="eyebrow">STAY IN THE LOOP</p><h1>Notifications</h1><p>Updates about your rides, errands, and account.</p></div>
        <div className="notification-history-actions">
          {notifications.some((item) => !item.isRead) && <button className="text-button" onClick={onMarkAllRead}>Mark all as read</button>}
          <button className="text-button" onClick={() => onNavigate('My requests')}>Go to my requests <ArrowRight size={15} /></button>
        </div>
      </div>
      {error && <p className="notification-error notification-history-error" role="alert">{error}</p>}
      <div className="panel notification-list">
        {notifications.length ? notifications.map((notification) => (
          <div className={`notification-item ${notification.isRead ? '' : 'unread'}`} key={notification.id}>
            <NotificationIcon type={notification.type} />
            <span className="notification-entry-copy"><strong>{notification.title}</strong><span>{notification.message}</span><time dateTime={notification.createdAt}>{notificationDate(notification.createdAt)}</time></span>
            {!notification.isRead && <button className="notification-read-action" onClick={() => onMarkRead(notification.id)}>Mark as read</button>}
            {!notification.isRead && <i className="notification-unread-dot" aria-label="Unread" />}
          </div>
        )) : !error ? <div className="notification-empty notification-history-empty"><span><Bell size={20} /></span><strong>No notifications yet</strong><small>Updates about your rides, errands, and account will appear here.</small></div> : null}
      </div>
    </div>
  )
}

function ProfilePage({ role, onLogout, onSaveProfile, onNotificationsChanged, user = null, demoMode = false, heading = 'My profile' }) {
  const fullName = String(user?.fullName || '').trim()
  const email = user?.email || ''
  const mobileNumber = user?.mobileNumber || ''
  const [name, setName] = useState(fullName)
  const [mobile, setMobile] = useState(mobileNumber)
  const [profileError, setProfileError] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)

  useEffect(() => {
    setName(fullName)
    setMobile(mobileNumber)
  }, [fullName, mobileNumber, user?.id])

  async function saveProfile(event) {
    event.preventDefault()
    setProfileBusy(true)
    setProfileError('')
    try {
      await onSaveProfile({ fullName: name, mobileNumber: mobile })
    } catch (error) {
      setProfileError(error.message)
    } finally {
      setProfileBusy(false)
    }
  }
  return (
    <div className="subpage qh-profile-page">
      <div className="subpage-header qh-profile-heading">
        <div><p className="eyebrow">YOUR QUICKHATID ACCOUNT</p><h1>{heading}</h1><p>Manage your personal information and keep your account secure.</p></div>
        <span className="qh-profile-location"><MapPin size={15} /> Don Carlos, Bukidnon</span>
      </div>
      <section className="qh-profile-banner">
        <div className="qh-profile-banner-orb" />
        <span className="qh-profile-banner-icon"><ShieldCheck size={21} /></span>
        <div><strong>Your account, your community.</strong><p>Keep your contact details up to date so local riders can reach you when needed.</p></div>
        <span className="qh-profile-role"><UserRound size={14} /> {role} account</span>
      </section>
      <div className="qh-profile-grid">
        <section className="panel qh-profile-card">
          <header className="qh-profile-card-heading"><div><p className="eyebrow">PERSONAL INFORMATION</p><h2>Profile details</h2><p>Update the information connected to your account.</p></div><span className="qh-profile-edit-icon"><Settings size={17} /></span></header>
          <div className="qh-profile-identity">
            <UserAvatar user={user} className="qh-profile-avatar" />
            <span><strong>{fullName || 'Welcome!'}</strong><small>{user?.username ? `@${user.username}` : 'QuickHatid member'}</small></span>
            <span className="qh-profile-verified"><ShieldCheck size={14} /> Active account</span>
          </div>
          <form className="qh-profile-form" onSubmit={saveProfile}>
            <div className="qh-profile-fields">
              <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={120} /></label>
              <label>Username<input value={user?.username || ''} readOnly /><small>Username cannot be changed here.</small></label>
              <label>Email address<input type="email" value={email} readOnly /><small>Your sign-in email is read-only.</small></label>
              <label>Mobile number<input type="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} autoComplete="tel" placeholder="Add your mobile number" required maxLength={24} /></label>
            </div>
            {profileError && <p className="profile-error" role="alert">{profileError}</p>}
            <div className="qh-profile-form-actions"><span><ShieldCheck size={14} /> Your information is only shown to you.</span><button className="primary-button" disabled={profileBusy}>{profileBusy ? 'Saving...' : 'Save changes'} <Check size={16} /></button></div>
          </form>
        </section>
        <aside className="qh-profile-side">
          <section className="panel qh-profile-access">
            <p className="eyebrow">ACCOUNT ACCESS</p><h2>Account role</h2><p>Your dashboard access is assigned by QuickHatid administrators.</p>
            <div className="qh-profile-access-row"><span><UserRound size={17} /></span><div><small>Current role</small><strong>{role}</strong></div><ShieldCheck size={17} /></div>
            <div className="qh-profile-security"><ShieldCheck size={17} /><span><strong>Protected account</strong><small>{demoMode ? 'Exhibition profile saved in this browser.' : 'Profile details are handled securely.'}</small></span></div>
          </section>
          <ChangePasswordForm demoMode={demoMode} onNotificationsChanged={onNotificationsChanged} />
          <button className="qh-profile-signout" onClick={onLogout}><LogOut size={16} /> Sign out of QuickHatid <ArrowRight size={15} /></button>
        </aside>
      </div>
    </div>
  )
}

function ChangePasswordForm({ demoMode, onNotificationsChanged }) {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  async function changePassword(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    const form = new FormData(event.currentTarget)
    const formElement = event.currentTarget
    try {
      if (demoMode) {
        const result = await demoRequest('/api/auth/change-password', {
          currentPassword: form.get('currentPassword'),
          newPassword: form.get('newPassword'),
          confirmPassword: form.get('confirmPassword'),
        })
        formElement.reset()
        setSuccess(result.message)
        await onNotificationsChanged?.()
        return
      }
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.get('currentPassword'),
          newPassword: form.get('newPassword'),
          confirmPassword: form.get('confirmPassword'),
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not change your password.')
      formElement.reset()
      setSuccess(result.message)
      await onNotificationsChanged?.()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }
  return <form className="panel change-password-card qh-password-card" onSubmit={changePassword}><p className="eyebrow">ACCOUNT SECURITY</p><h3>Change password</h3><p className="qh-password-description">Choose a strong password that you don’t use elsewhere.</p><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={10} required /></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required /></label>{error && <p className="profile-error" role="alert">{error}</p>}{success && <p className="profile-success" role="status">{success}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Updating...' : 'Update password'} <ShieldCheck size={15} /></button></form>
}

function RoleOverview({ role, setRole, onBook }) {
  const rider = role === 'Rider'
  return <div className="role-welcome"><div className="role-welcome-top"><div><span className="eyebrow">{rider ? 'RIDER WORKSPACE' : 'ADMIN CONTROL CENTER'}</span><h2>{rider ? 'Ready to ride, Jomar?' : 'Here’s your service overview.'}</h2><p>{rider ? 'Your account is verified and ready to accept requests.' : 'A live look at what’s happening in Don Carlos today.'}</p></div><span className={`verification-tag ${rider ? '' : 'admin-tag'}`}><ShieldCheck size={16} />{rider ? 'Verified rider' : 'Administrator'}</span></div><div className="role-stats"><div><small>{rider ? 'TODAY’S EARNINGS' : 'REGISTERED CUSTOMERS'}</small><strong>{rider ? '₱1,240' : '1,284'}</strong><span>{rider ? '+₱240 from yesterday' : '+12% this month'}</span></div><div><small>{rider ? 'COMPLETED THIS WEEK' : 'VERIFIED RIDERS'}</small><strong>{rider ? '18' : '46'}</strong><span>{rider ? 'You’re on a roll!' : '4 applications pending'}</span></div><div><small>{rider ? 'YOUR RATING' : 'ACTIVE REQUESTS'}</small><strong>{rider ? '4.9 ★' : '23'}</strong><span>{rider ? 'Based on 128 reviews' : 'Across rides and errands'}</span></div><div><small>{rider ? 'AVAILABILITY' : 'SERVICE FEES TODAY'}</small><strong>{rider ? 'Online' : '₱8,450'}</strong><span>{rider ? 'Ready for new requests' : 'From 57 completed trips'}</span></div></div><div className="role-callout"><span className="role-callout-icon">{rider ? <Bike size={20} /> : <Settings size={20} />}</span><span><strong>{rider ? '4 requests near you' : '3 rider applications need review'}</strong><small>{rider ? 'Customers nearby are waiting for a friendly local rider.' : 'New applicants are ready for verification.'}</small></span><button onClick={() => rider ? onBook('ride') : setRole('Customer')}>{rider ? 'See available requests' : 'Open rider review'} <ArrowRight size={15} /></button></div><div className="role-note">{rider ? 'Rider mode is a UI preview. Real requests require administrator verification and a connected backend.' : 'Admin mode is a UI preview. Account and rider management require a connected backend.'}</div></div>
}

function RequestModal({ kind, onClose, onSubmit }) {
  const ride = kind === 'ride'
  const [service, setService] = useState(ride ? 'Motorcycle ride' : 'Grocery shopping')
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [details, setDetails] = useState('')
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState('')
  const fee = ride ? service === 'Point-to-point travel' ? 80 : 50 : service === 'Grocery shopping' ? 80 : service === 'Medicine pickup' ? 70 : 60
  function submit(event) {
    event.preventDefault()
    if (!pickup.trim() || !destination.trim()) {
      setError('Please enter both pickup and destination locations.')
      return
    }
    if (!ride && !details.trim()) {
      setError('Please tell us a little more about your errand.')
      return
    }
    onSubmit({ service, kind, from: pickup.trim(), to: destination.trim(), fee, details: details.trim(), instructions: instructions.trim() })
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="request-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><span className={`big-service-icon ${ride ? 'orange' : 'green'}`}>{ride ? <Bike size={22} /> : <ShoppingBasket size={22} />}</span><div><p className="eyebrow">{ride ? 'RIDE BOOKING' : 'ERRAND DELIVERY'}</p><h2 id="modal-title">{ride ? 'Book a ride' : 'Request an errand'}</h2></div><button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button></div><form onSubmit={submit}><label className="form-field">Service type<select value={service} onChange={(event) => setService(event.target.value)}>{(ride ? ['Motorcycle ride', 'Point-to-point travel'] : ['Grocery shopping', 'Food pickup', 'Medicine pickup', 'Document delivery', 'Other personal errand']).map((item) => <option key={item}>{item}</option>)}</select></label><div className="form-row"><label className="form-field"><span>{ride ? 'Pickup location' : 'Store or pickup location'}</span><span className="field-control"><MapPin size={16} /><input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="e.g. Poblacion, Don Carlos" required /></span></label><label className="form-field"><span>{ride ? 'Destination' : 'Delivery address'}</span><span className="field-control"><MapPin size={16} /><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Barangay or landmark" required /></span></label></div>{!ride && <label className="form-field">What do you need?<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Add items, quantities, or anything we should know..." rows="3" /></label>}<label className="form-field">Additional instructions <input value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Optional notes for your rider" /></label><div className="fee-summary"><span><small>ESTIMATED SERVICE FEE</small><strong>₱{fee}.00</strong></span><span className="fee-cash"><Wallet size={15} /> Cash to rider</span></div>{error && <p className="form-error">{error}</p>}<button type="submit" className="primary-button modal-submit">Confirm request <ArrowRight size={16} /></button><p className="modal-footnote"><ShieldCheck size={13} /> Your request will be sent to verified local riders nearby.</p></form></section></div>
}

function EmptyState({ title, text }) { return <div className="empty-state"><span><Search size={21} /></span><strong>{title}</strong><p>{text}</p></div> }

export default App
