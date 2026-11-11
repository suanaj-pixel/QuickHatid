import { StatusBar } from 'expo-status-bar'
import * as SecureStore from 'expo-secure-store'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

const colors = {
  blue: '#164A8A',
  deepBlue: '#10366B',
  mist: '#EDF4FC',
  gold: '#E2B52F',
  red: '#C9343F',
  background: '#F7F9FC',
  white: '#FFFFFF',
  ink: '#1E2938',
  muted: '#718096',
  line: '#E4EAF1',
  green: '#24865E',
}

const apiBase = (process.env.EXPO_PUBLIC_API_URL
  || (Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001'))
  .replace(/\/+$/, '')
const tokenKey = 'quickhatid_access_token'

type User = {
  id: number
  fullName: string
  username: string
  email: string
  mobileNumber: string
  role: string
}

type RequestItem = {
  id: string
  kind: 'ride' | 'errand'
  service: string
  from: string
  to: string
  details: string
  instructions: string
  fee: number
  status: string
  date: string
}

type Tab = 'Overview' | 'Book a ride' | 'Errands' | 'My requests' | 'Profile'

type ApiResult<T> = T & { error?: string; fields?: Record<string, string> }

async function apiRequest<T>(path: string, token?: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-QuickHatid-Client': 'native',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json().catch(() => ({})) as ApiResult<T>
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`)
  return result
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  multiline?: boolean
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA6B5"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
      />
    </View>
  )
}

function ActionButton({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string
  onPress: () => void
  secondary?: boolean
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        secondary && styles.secondaryButton,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {disabled
        ? <ActivityIndicator color={secondary ? colors.blue : colors.white} />
        : <Text style={[styles.actionText, secondary && styles.secondaryText]}>{title}</Text>}
    </Pressable>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  )
}

function AppContent() {
  const insets = useSafeAreaInsets()
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState('')
  const [tab, setTab] = useState<Tab>('Overview')
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [registering, setRegistering] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [service, setService] = useState('Motorcycle ride')
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [details, setDetails] = useState('')
  const [instructions, setInstructions] = useState('')
  const isErrand = tab === 'Errands'

  useEffect(() => {
    let active = true
    async function restoreSession() {
      try {
        const savedToken = await SecureStore.getItemAsync(tokenKey)
        if (!savedToken) return
        const result = await apiRequest<{ user: User }>('/api/auth/me', savedToken)
        if (active) {
          setToken(savedToken)
          setUser(result.user)
        }
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : 'Could not restore your sign-in. Check your API connection.')
      } finally {
        if (active) setLoading(false)
      }
    }
    restoreSession()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (user && token) refreshRequests()
  }, [user, token])

  async function refreshRequests() {
    try {
      const result = await apiRequest<{ requests: RequestItem[] }>('/api/requests', token)
      setRequests(result.requests)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load requests.')
    }
  }

  async function authenticate() {
    setBusy(true)
    setError('')
    try {
      const path = registering ? '/api/auth/register' : '/api/auth/login'
      const body = registering
        ? { fullName, username, email, mobileNumber, password, confirmPassword }
        : { identifier, password, remember: true }
      const result = await apiRequest<{ user: User; accessToken?: string; message?: string }>(
        path,
        undefined,
        'POST',
        body,
      )
      if (!result.accessToken) throw new Error('The server did not return a mobile session. Update the API server and try again.')
      await SecureStore.setItemAsync(tokenKey, result.accessToken)
      setToken(result.accessToken)
      setUser(result.user)
      setPassword('')
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  async function submitRequest() {
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest<{ request: RequestItem }>('/api/requests', token, 'POST', {
        kind: isErrand ? 'errand' : 'ride',
        service,
        from: pickup,
        to: destination,
        details: isErrand ? details : '',
        instructions,
      })
      setPickup('')
      setDestination('')
      setDetails('')
      setInstructions('')
      setRequests((current) => [result.request, ...current])
      setTab('My requests')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not submit the request.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    try {
      await apiRequest('/api/auth/logout', token, 'POST')
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Could not sign out.')
      setBusy(false)
      return
    }
    await SecureStore.deleteItemAsync(tokenKey)
    setUser(null)
    setToken('')
    setRequests([])
    setTab('Overview')
    setBusy(false)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={styles.loadingText}>Opening QuickHatid...</Text>
        <StatusBar style="dark" />
      </SafeAreaView>
    )
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <StatusBar style="dark" />
          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
            <View style={styles.brandMark}><Ionicons name="flash" size={25} color={colors.white} /></View>
            <Text style={styles.brandTitle}>quick<Text style={styles.brandBlue}>hatid</Text></Text>
            <Text style={styles.tagline}>YOUR LOCAL SERVICE, ON THE WAY</Text>
            <View style={styles.authCard}>
              <Text style={styles.eyebrow}>WELCOME TO DON CARLOS</Text>
              <Text style={styles.title}>{registering ? 'Create your account' : 'Your town, a little closer.'}</Text>
              <Text style={styles.subtitle}>{registering ? 'Sign up to request rides and errands.' : 'Sign in to book a ride or request an errand.'}</Text>
              {registering ? (
                <>
                  <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" />
                  <Field label="Username" value={username} onChangeText={setUsername} placeholder="Choose a username" />
                  <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
                  <Field label="Mobile number" value={mobileNumber} onChangeText={setMobileNumber} placeholder="09xx xxx xxxx" keyboardType="phone-pad" />
                  <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 10 characters" secureTextEntry />
                  <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter your password" secureTextEntry />
                </>
              ) : (
                <>
                  <Field label="Email or username" value={identifier} onChangeText={setIdentifier} placeholder="Enter your email or username" />
                  <Field label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry />
                </>
              )}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <ActionButton title={registering ? 'Create account' : 'Sign in'} onPress={authenticate} disabled={busy} />
              <Pressable onPress={() => { setRegistering(!registering); setError('') }} style={styles.switchAuth}>
                <Text style={styles.switchText}>
                  {registering ? 'Already have an account? ' : 'New to QuickHatid? '}
                  <Text style={styles.switchAccent}>{registering ? 'Sign in' : 'Create account'}</Text>
                </Text>
              </Pressable>
            </View>
            <Text style={styles.location}>Serving Don Carlos, Bukidnon</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  const tabs: { title: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { title: 'Overview', label: 'Home', icon: 'home-outline' },
    { title: 'Book a ride', label: 'Ride', icon: 'bicycle-outline' },
    { title: 'Errands', label: 'Errands', icon: 'bag-handle-outline' },
    { title: 'My requests', label: 'Requests', icon: 'receipt-outline' },
    { title: 'Profile', label: 'Profile', icon: 'person-outline' },
  ]

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.topbar}>
        <View>
          <Text style={styles.topbarBrand}>quick<Text style={styles.brandBlue}>hatid</Text></Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={12} color={colors.blue} />
            <Text style={styles.topbarLocation}>DON CARLOS, BUKIDNON</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => setTab('Profile')} style={styles.avatar}>
          <Text style={styles.avatarText}>{user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Pressable onPress={() => setError('')}><Text style={styles.errorBanner}>{error}  ×</Text></Pressable> : null}
        {tab === 'Overview' && (
          <>
            <Text style={styles.eyebrow}>QUICKHATID MARKETPLACE</Text>
            <Text style={styles.title}>Hi, {user.fullName.split(' ')[0]}!</Text>
            <Text style={styles.subtitle}>Where would you like to go today?</Text>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>YOUR TOWN, A LITTLE CLOSER</Text>
              <Text style={styles.heroTitle}>Your ride and errands, just one tap away.</Text>
              <Text style={styles.heroCopy}>Quick, convenient service from your neighbors.</Text>
              <ActionButton title="Book a ride  →" onPress={() => { setService('Motorcycle ride'); setTab('Book a ride') }} />
              <ActionButton title="Request an errand" secondary onPress={() => { setService('Grocery shopping'); setTab('Errands') }} />
            </View>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={styles.statIcon}><Ionicons name="receipt-outline" size={17} color={colors.blue} /></View>
                  <Text style={styles.statNumber}>{requests.length}</Text>
                  <Text style={styles.statLabel}>TOTAL REQUESTS</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, styles.statIconGold]}><Ionicons name="time-outline" size={17} color="#A37A0A" /></View>
                  <Text style={styles.statNumber}>{requests.filter((request) => !['Completed', 'Cancelled'].includes(request.status)).length}</Text>
                  <Text style={styles.statLabel}>IN PROGRESS</Text>
                </View>
              </View>
            <Text style={styles.sectionTitle}>How can we help?</Text>
            <View style={styles.serviceRow}>
              <Pressable style={styles.serviceCard} onPress={() => { setService('Motorcycle ride'); setTab('Book a ride') }}>
                <View style={styles.serviceIcon}><Ionicons name="bicycle" size={22} color={colors.blue} /></View><Text style={styles.serviceTitle}>Book a ride</Text><Text style={styles.serviceSub}>From ₱50</Text>
              </Pressable>
              <Pressable style={styles.serviceCard} onPress={() => { setService('Grocery shopping'); setTab('Errands') }}>
                <View style={[styles.serviceIcon, styles.errandServiceIcon]}><Ionicons name="bag-handle" size={21} color={colors.green} /></View><Text style={styles.serviceTitle}>Errand delivery</Text><Text style={styles.serviceSub}>From ₱60</Text>
              </Pressable>
            </View>
            <ActionButton title="View my requests" secondary onPress={() => { setError(''); setTab('My requests') }} />
          </>
        )}

        {(tab === 'Book a ride' || tab === 'Errands') && (
          <>
            <Text style={styles.eyebrow}>{isErrand ? 'ERRAND DELIVERY' : 'RIDE BOOKING'}</Text>
            <Text style={styles.title}>{isErrand ? 'Your to-do, taken care of.' : 'Where to next?'}</Text>
            <Text style={styles.subtitle}>A friendly local rider is just around the corner.</Text>
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Choose a service</Text>
              <View style={styles.optionList}>
                {(isErrand
                  ? ['Grocery shopping', 'Food pickup', 'Medicine pickup', 'Document delivery']
                  : ['Motorcycle ride', 'Point-to-point travel']
                ).map((option) => (
                  <Pressable key={option} onPress={() => setService(option)} style={[styles.option, service === option && styles.optionSelected]}>
                    <Text style={[styles.optionText, service === option && styles.optionTextSelected]}>{option}</Text>
                    <Text style={styles.optionCheck}>{service === option ? '●' : '○'}</Text>
                  </Pressable>
                ))}
              </View>
              <Field label={isErrand ? 'Store or pickup location' : 'Pickup location'} value={pickup} onChangeText={setPickup} placeholder="e.g. Poblacion, Don Carlos" />
              <Field label={isErrand ? 'Delivery address' : 'Destination'} value={destination} onChangeText={setDestination} placeholder="Barangay or landmark" />
              {isErrand && <Field label="What do you need?" value={details} onChangeText={setDetails} placeholder="Add items or instructions for your rider" multiline />}
              <Field label="Additional instructions" value={instructions} onChangeText={setInstructions} placeholder="Optional notes" />
              <ActionButton title={isErrand ? 'Place errand request' : 'Request this ride'} onPress={submitRequest} disabled={busy || !pickup.trim() || !destination.trim()} />
            </View>
          </>
        )}

        {tab === 'My requests' && (
          <>
            <Text style={styles.eyebrow}>YOUR ACTIVITY</Text>
            <Text style={styles.title}>My requests</Text>
            <Text style={styles.subtitle}>Ride and errand requests you have placed.</Text>
            {requests.length === 0
              ? <View style={styles.emptyCard}><Ionicons name="receipt-outline" size={33} color={colors.blue} /><Text style={styles.sectionTitle}>No requests yet</Text><Text style={styles.subtitle}>Your bookings will appear here.</Text><ActionButton title="Book a ride" onPress={() => setTab('Book a ride')} /></View>
              : requests.map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestTop}>
                    <View style={styles.requestKindRow}>
                      <Ionicons name={request.kind === 'ride' ? 'bicycle-outline' : 'bag-handle-outline'} size={15} color={colors.blue} />
                      <Text style={styles.requestKind}>{request.kind === 'ride' ? 'RIDE' : 'ERRAND'}</Text>
                    </View>
                    <Text style={[styles.requestStatus, request.status === 'Completed' ? styles.statusComplete : request.status === 'Cancelled' ? styles.statusCancelled : styles.statusActive]}>{request.status}</Text>
                  </View>
                  <Text style={styles.requestService}>{request.service}</Text>
                  <Text style={styles.requestRoute}>From  {request.from}</Text>
                  <Text style={styles.requestRoute}>To      {request.to}</Text>
                  <View style={styles.requestBottom}><Text style={styles.requestId}>{request.id}</Text><Text style={styles.requestFee}>₱{request.fee}</Text></View>
                </View>
              ))}
            <ActionButton title="Refresh requests" secondary onPress={refreshRequests} />
          </>
        )}

        {tab === 'Profile' && (
          <>
            <Text style={styles.eyebrow}>YOUR QUICKHATID ACCOUNT</Text>
            <Text style={styles.title}>My profile</Text>
            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</Text></View>
              <Text style={styles.profileName}>{user.fullName}</Text>
              <Text style={styles.profileDetail}>{user.email}</Text>
              <Text style={styles.profileDetail}>{user.mobileNumber}</Text>
              <Text style={styles.rolePill}>{user.role}</Text>
            </View>
            <ActionButton title="Sign out" secondary onPress={() => Alert.alert('Sign out?', 'You will need to sign in again to use QuickHatid.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: signOut }])} disabled={busy} />
          </>
        )}
      </ScrollView>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {tabs.map((item) => {
          const selected = tab === item.title
          return (
          <Pressable
            key={item.title}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => { setError(''); setTab(item.title) }}
            style={styles.tabItem}
          >
            <View style={[styles.tabIconWrap, selected && styles.tabIconWrapActive]}>
              <Ionicons name={selected ? item.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap : item.icon} size={20} color={selected ? colors.blue : colors.muted} />
            </View>
            <Text style={[styles.tabLabel, selected && styles.tabActive]}>{item.label}</Text>
          </Pressable>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, color: colors.muted, fontSize: 14 },
  authContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 28 },
  brandMark: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  brandTitle: { color: colors.ink, fontWeight: '800', fontSize: 28, letterSpacing: -1 },
  brandBlue: { color: colors.blue },
  tagline: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.4, marginTop: 1, marginBottom: 27 },
  authCard: { backgroundColor: colors.white, borderRadius: 19, padding: 21, borderWidth: 1, borderColor: colors.line },
  eyebrow: { color: colors.blue, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  title: { color: colors.ink, fontWeight: '800', fontSize: 25, letterSpacing: -0.5, marginBottom: 7 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 19 },
  field: { marginBottom: 13 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 13, color: colors.ink, backgroundColor: colors.white, fontSize: 14 },
  multiline: { minHeight: 86, paddingTop: 12 },
  actionButton: { minHeight: 48, borderRadius: 11, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 9 },
  secondaryButton: { backgroundColor: colors.mist, borderWidth: 1, borderColor: '#D7E5F6' },
  actionText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  secondaryText: { color: colors.blue },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  switchAuth: { alignItems: 'center', paddingTop: 17, paddingBottom: 2 },
  switchText: { fontSize: 13, color: colors.muted },
  switchAccent: { color: colors.blue, fontWeight: '800' },
  location: { textAlign: 'center', color: colors.muted, fontSize: 11, marginTop: 22 },
  error: { color: colors.red, fontSize: 13, lineHeight: 18, marginBottom: 9 },
  errorBanner: { backgroundColor: '#FCEBED', color: colors.red, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12 },
  topbar: { minHeight: 65, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topbarBrand: { fontSize: 19, fontWeight: '800', color: colors.ink, letterSpacing: -0.6 },
  topbarLocation: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  avatar: { width: 37, height: 37, borderRadius: 20, backgroundColor: colors.mist, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.blue, fontWeight: '800', fontSize: 12 },
  page: { flex: 1 },
  pageContent: { padding: 20, paddingTop: 22, paddingBottom: 30 },
  hero: { backgroundColor: colors.blue, borderRadius: 20, padding: 21, marginBottom: 15, overflow: 'hidden', elevation: 3, shadowColor: colors.deepBlue, shadowOpacity: 0.13, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  heroEyebrow: { color: '#D7E7FA', fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginBottom: 10 },
  heroTitle: { color: colors.white, fontWeight: '800', fontSize: 25, lineHeight: 31, marginBottom: 8 },
  heroCopy: { color: '#E4ECF7', fontSize: 13, lineHeight: 20, marginBottom: 9 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  statCard: { flex: 1, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 13, minHeight: 106 },
  statIcon: { width: 29, height: 29, borderRadius: 9, backgroundColor: colors.mist, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  statIconGold: { backgroundColor: '#FFF6D8' },
  statNumber: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.7, marginTop: 1 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  serviceRow: { flexDirection: 'row', gap: 11, marginBottom: 10 },
  serviceCard: { flex: 1, minHeight: 123, borderRadius: 14, backgroundColor: colors.white, padding: 14, borderWidth: 1, borderColor: colors.line, elevation: 1 },
  serviceIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: colors.mist, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  errandServiceIcon: { backgroundColor: '#EAF6F0' },
  serviceTitle: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  serviceSub: { color: colors.muted, fontSize: 11, marginTop: 5 },
  formCard: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16 },
  optionList: { gap: 7, marginBottom: 15 },
  option: { minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  optionSelected: { backgroundColor: colors.mist, borderColor: '#B9D0EC' },
  optionText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  optionTextSelected: { color: colors.blue, fontWeight: '800' },
  optionCheck: { color: colors.blue, fontSize: 14 },
  emptyCard: { backgroundColor: colors.white, alignItems: 'center', padding: 22, borderRadius: 15, borderWidth: 1, borderColor: colors.line, marginTop: 7 },
  requestCard: { backgroundColor: colors.white, borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 15, marginBottom: 11, elevation: 1 },
  requestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  requestKindRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  requestKind: { color: colors.blue, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  requestStatus: { color: colors.green, fontWeight: '700', fontSize: 10, backgroundColor: '#EAF6F0', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 20 },
  statusActive: { color: colors.blue, backgroundColor: colors.mist },
  statusComplete: { color: colors.green, backgroundColor: '#EAF6F0' },
  statusCancelled: { color: colors.red, backgroundColor: '#FCEBED' },
  requestService: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 11 },
  requestRoute: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  requestBottom: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'space-between' },
  requestId: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  requestFee: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  profileCard: { backgroundColor: colors.white, borderRadius: 16, alignItems: 'center', padding: 23, borderWidth: 1, borderColor: colors.line, marginVertical: 7 },
  profileAvatar: { width: 68, height: 68, borderRadius: 36, backgroundColor: colors.mist, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  profileAvatarText: { color: colors.blue, fontWeight: '800', fontSize: 19 },
  profileName: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 5 },
  profileDetail: { color: colors.muted, fontSize: 12, marginTop: 3 },
  rolePill: { color: colors.blue, backgroundColor: colors.mist, fontSize: 10, fontWeight: '800', textTransform: 'capitalize', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginTop: 13 },
  tabBar: { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 2 },
  tabIconWrap: { minWidth: 56, height: 28, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabIconWrapActive: { backgroundColor: colors.mist },
  tabLabel: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  tabActive: { color: colors.blue },
})
