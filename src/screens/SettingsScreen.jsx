import { useEffect, useState } from 'react'
import { brand, palette } from '../theme.js'
import { signIn, signUp, signOut, createHousehold, createInviteCode, acceptInvite } from '../lib/db.js'
import { isSupabaseConfigured } from '../lib/supabase.js'

function Card({ children, p }) {
  return (
    <div style={{ margin: '0 14px 12px', background: p.card, borderRadius: 18, border: `1px solid ${p.border}`, padding: '16px 16px' }}>
      {children}
    </div>
  )
}

export default function SettingsScreen({ night, authUser, profile, householdMembers = [], onProfileUpdate, onRefreshHouseholdMembers, onResync }) {
  const p = palette(night)
  const householdMembersReady = Array.isArray(householdMembers)
  const memberList = householdMembersReady ? householdMembers : []
  const connectedMembers = memberList.filter(member => member.id !== authUser?.id)
  const hasConnectedFamily = connectedMembers.length > 0

  // ── Auth form state ────────────────────────────────────────────────────────
  const [authTab,      setAuthTab]      = useState('signin')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName,  setDisplayName]  = useState('')
  const [authLoading,  setAuthLoading]  = useState(false)
  const [authMsg,      setAuthMsg]      = useState(null)  // { text, isError }

  // ── Household state ────────────────────────────────────────────────────────
  const [inviteCode,       setInviteCode]       = useState(null)
  const [joinCode,         setJoinCode]         = useState('')
  const [householdLoading, setHouseholdLoading] = useState(false)
  const [householdMsg,     setHouseholdMsg]     = useState(null)  // { text, isError }
  const [copied,           setCopied]           = useState(false)
  const [syncing,          setSyncing]          = useState(false)
  const [syncDone,         setSyncDone]         = useState(false)

  const inputStyle = {
    width: '100%', background: p.bg, border: `1px solid ${p.border}`,
    borderRadius: 11, padding: '11px 13px', fontSize: 15, color: p.text,
    fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block', fontSize: 10, color: p.sub,
    letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6,
  }

  const primaryBtn = {
    width: '100%', padding: '13px', borderRadius: 13, border: 'none',
    background: brand.bark, color: brand.sand, cursor: 'pointer',
    fontSize: 14, fontWeight: 500, marginTop: 4,
  }

  const secondaryBtn = {
    width: '100%', padding: '13px', borderRadius: 13,
    border: `1px solid ${p.border}`, background: 'transparent',
    color: p.text, cursor: 'pointer', fontSize: 14, marginTop: 8,
  }

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!email || !password) return
    setAuthLoading(true)
    setAuthMsg(null)
    const { error } = await signIn(email, password)
    if (error) setAuthMsg({ text: error.message, isError: true })
    setAuthLoading(false)
  }

  const handleSignUp = async () => {
    if (!email || !password) return
    setAuthLoading(true)
    setAuthMsg(null)
    const { error } = await signUp(email, password, displayName.trim() || email.split('@')[0])
    if (error) {
      setAuthMsg({ text: error.message, isError: true })
    } else {
      setAuthMsg({ text: 'Check your email to confirm your account, then sign in.', isError: false })
      setAuthTab('signin')
    }
    setAuthLoading(false)
  }

  const handleSignOut = async () => {
    await signOut()
  }

  // ── Household handlers ─────────────────────────────────────────────────────
  const handleCreateHousehold = async () => {
    setHouseholdLoading(true)
    setHouseholdMsg(null)
    const { error } = await createHousehold()
    if (error) {
      setHouseholdMsg({ text: error.message, isError: true })
    } else {
      onProfileUpdate()
    }
    setHouseholdLoading(false)
  }

  const handleGetInviteCode = async () => {
    setHouseholdLoading(true)
    setHouseholdMsg(null)
    const { code, error } = await createInviteCode()
    if (error) {
      setHouseholdMsg({ text: error.message, isError: true })
    } else {
      setInviteCode(code)
    }
    setHouseholdLoading(false)
  }

  const handleCopy = () => {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setHouseholdLoading(true)
    setHouseholdMsg(null)
    const { error } = await acceptInvite(joinCode.trim())
    if (error) {
      setHouseholdMsg({ text: error.message, isError: true })
    } else {
      setJoinCode('')
      onProfileUpdate()
    }
    setHouseholdLoading(false)
  }

  const handleResync = async () => {
    setSyncing(true)
    setSyncDone(false)
    await onResync?.()
    await onRefreshHouseholdMembers?.()
    setSyncing(false)
    setSyncDone(true)
    setTimeout(() => setSyncDone(false), 2500)
  }

  useEffect(() => {
    if (!authUser || !profile?.household_id) return
    onRefreshHouseholdMembers?.()
    const refreshTimer = setInterval(() => {
      onRefreshHouseholdMembers?.()
    }, 30000)
    return () => clearInterval(refreshTimer)
  }, [authUser, profile?.household_id, onRefreshHouseholdMembers])

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 16px' }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>
          Sharing &amp; account
        </span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: p.heading, marginTop: 2 }}>
          Your family
        </span>
      </div>

      {/* ── Auth card ── */}
      {!isSupabaseConfigured ? (
        <Card p={p}>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: p.heading, marginBottom: 10 }}>
            Sharing unavailable
          </span>
          <span style={{ display: 'block', fontSize: 13, color: p.sub, lineHeight: 1.6, marginBottom: 14 }}>
            The Supabase credentials haven't reached this build. Check each step below.
          </span>
          {[
            'In Vercel → Settings → Environment Variables, both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be present (names must start with VITE_)',
            'Both variables must have the Preview environment ticked, not just Production',
            'After saving the variables you must trigger a fresh deploy — Vercel bakes them in at build time',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: p.bg, border: `1px solid ${p.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: p.sub, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: p.sub, lineHeight: 1.55 }}>{step}</span>
            </div>
          ))}
        </Card>
      ) : !authUser ? (
        <Card p={p}>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: p.heading, marginBottom: 12 }}>
            Sign in to share feeds
          </span>
          <span style={{ display: 'block', fontSize: 13, color: p.sub, lineHeight: 1.5, marginBottom: 14 }}>
            Create a free account so both parents can log feeds and see a shared history together.
          </span>

          {/* Tab toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[{ id: 'signin', label: 'Sign in' }, { id: 'signup', label: 'Create account' }].map(t => (
              <button key={t.id} onClick={() => { setAuthTab(t.id); setAuthMsg(null); setPassword('') }}
                style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1.5px solid ${authTab === t.id ? brand.sand : p.border}`, background: authTab === t.id ? brand.bark : 'transparent', color: authTab === t.id ? brand.sand : p.sub, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                {t.label}
              </button>
            ))}
          </div>

          {authTab === 'signup' && (
            <div style={{ marginBottom: 10 }}>
              <span style={labelStyle}>Your name</span>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Sarah"
                style={{ ...inputStyle, marginBottom: 10 }}
              />
            </div>
          )}

          <span style={labelStyle}>Email</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') authTab === 'signin' ? handleSignIn() : handleSignUp() }}
            placeholder="you@example.com"
            style={{ ...inputStyle, marginBottom: 10 }}
          />

          <span style={labelStyle}>Password</span>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') authTab === 'signin' ? handleSignIn() : handleSignUp() }}
              placeholder={authTab === 'signin' ? 'Enter your password' : 'Create a password'}
              autoComplete={authTab === 'signin' ? 'current-password' : 'new-password'}
              style={{ ...inputStyle, paddingRight: 56 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: p.sub, fontSize: 12, padding: '4px 4px', fontFamily: "'DM Sans', sans-serif" }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {authMsg && (
            <div style={{ fontSize: 12, color: authMsg.isError ? '#c0392b' : brand.green, marginBottom: 10, lineHeight: 1.4 }}>
              {authMsg.text}
            </div>
          )}

          <button
            onClick={authTab === 'signin' ? handleSignIn : handleSignUp}
            disabled={authLoading || !email || !password}
            style={{ ...primaryBtn, opacity: (authLoading || !email || !password) ? 0.6 : 1 }}
          >
            {authLoading ? 'Please wait…' : authTab === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </Card>
      ) : (
        <Card p={p}>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: p.heading, marginBottom: 10 }}>
            Account
          </span>
          <span style={{ display: 'block', fontSize: 12, color: p.sub, marginBottom: 4 }}>Signed in as</span>
          <span style={{ display: 'block', fontSize: 14, color: p.text, fontWeight: 500, marginBottom: 14 }}>
            {authUser.email}
          </span>
          {profile?.display_name && (
            <>
              <span style={{ display: 'block', fontSize: 12, color: p.sub, marginBottom: 4 }}>Name</span>
              <span style={{ display: 'block', fontSize: 14, color: p.text, fontWeight: 500, marginBottom: 14 }}>
                {profile.display_name}
              </span>
            </>
          )}
          <button onClick={handleSignOut} style={{ ...secondaryBtn, marginTop: 0, color: '#c0392b', borderColor: '#c0392b22' }}>
            Sign out
          </button>
        </Card>
      )}

      {/* ── Household card (only when logged in) ── */}
      {authUser && !profile?.household_id && (
        <Card p={p}>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: p.heading, marginBottom: 10 }}>
            Set up sharing
          </span>
          <span style={{ display: 'block', fontSize: 13, color: p.sub, lineHeight: 1.5, marginBottom: 14 }}>
            Create a household to start sharing feeds with your partner. You'll get an invite code to send them.
          </span>

          {householdMsg && (
            <div style={{ fontSize: 12, color: householdMsg.isError ? '#c0392b' : brand.green, marginBottom: 10, lineHeight: 1.4 }}>
              {householdMsg.text}
            </div>
          )}

          <button onClick={handleCreateHousehold} disabled={householdLoading}
            style={{ ...primaryBtn, opacity: householdLoading ? 0.6 : 1 }}>
            {householdLoading ? 'Creating…' : 'Create household'}
          </button>

          {/* Join section */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${p.border}` }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: p.heading, marginBottom: 8 }}>
              Or join your partner's household
            </span>
            <span style={labelStyle}>Invite code</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') handleJoin() }}
                placeholder="XXXXXXXX"
                maxLength={8}
                style={{ ...inputStyle, flex: 1, letterSpacing: '.1em', fontFamily: 'monospace', fontSize: 16 }}
              />
              <button onClick={handleJoin} disabled={householdLoading || !joinCode.trim()}
                style={{ padding: '0 16px', borderRadius: 11, border: 'none', background: brand.bark, color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500, opacity: (!joinCode.trim() || householdLoading) ? 0.5 : 1 }}>
                Join
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Invite code card (when household exists) ── */}
      {authUser && profile?.household_id && (
        <Card p={p}>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: p.heading, marginBottom: 10 }}>
            Shared logbook
          </span>

          {!householdMembersReady && (
            <span style={{ display: 'block', fontSize: 13, color: p.sub, lineHeight: 1.5, marginBottom: 14 }}>
              Checking your family group...
            </span>
          )}

          {memberList.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ display: 'block', fontSize: 12, color: p.sub, lineHeight: 1.5, marginBottom: 10 }}>
                {hasConnectedFamily ? 'Your family group is connected.' : 'Your household is ready. Invite your partner when you are ready to share.'}
              </span>
              <div style={{ display: 'grid', gap: 8 }}>
                {memberList.map(member => {
                  const isYou = member.id === authUser.id
                  return (
                    <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: '10px 12px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: isYou ? brand.accent : brand.green, display: 'inline-block', flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13, color: p.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.display_name || member.email || 'Family member'}{isYou ? ' (you)' : ''}
                        </span>
                        {member.email && (
                          <span style={{ display: 'block', fontSize: 11, color: p.sub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {member.email}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {householdMembersReady && (profile.role === 'primary' && !hasConnectedFamily ? (
            <>
              <span style={{ display: 'block', fontSize: 13, color: p.sub, lineHeight: 1.5, marginBottom: 14 }}>
                Your partner can join by entering an invite code. Generate one below and send it to them.
              </span>

              {householdMsg && (
                <div style={{ fontSize: 12, color: householdMsg.isError ? '#c0392b' : brand.green, marginBottom: 10, lineHeight: 1.4 }}>
                  {householdMsg.text}
                </div>
              )}

              {inviteCode ? (
                <>
                  <span style={{ display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Invite code
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, background: p.bg, borderRadius: 12, border: `1px solid ${p.border}`, padding: '12px 14px', fontFamily: 'monospace', fontSize: 20, letterSpacing: '.18em', color: p.heading, textAlign: 'center' }}>
                      {inviteCode}
                    </div>
                    <button onClick={handleCopy}
                      style={{ padding: '12px 14px', borderRadius: 12, border: 'none', background: copied ? brand.green : brand.bark, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, flexShrink: 0, transition: 'background .3s' }}>
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <span style={{ display: 'block', fontSize: 11, color: p.sub, marginTop: 8 }}>
                    Expires in 24 hours. Generate a new one if it doesn't work.
                  </span>
                  <button onClick={handleGetInviteCode} disabled={householdLoading}
                    style={{ ...secondaryBtn, fontSize: 12, padding: '10px', opacity: householdLoading ? 0.6 : 1 }}>
                    Generate new code
                  </button>
                </>
              ) : (
                <button onClick={handleGetInviteCode} disabled={householdLoading}
                  style={{ ...primaryBtn, opacity: householdLoading ? 0.6 : 1 }}>
                  {householdLoading ? 'Generating…' : 'Generate invite code'}
                </button>
              )}
            </>
          ) : (
            <div>
              <span style={{ display: 'block', fontSize: 13, color: p.sub, lineHeight: 1.5, marginBottom: 4 }}>
                {hasConnectedFamily ? 'Sharing is active for this family group.' : "You've joined a shared household."}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: brand.green, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: p.text, fontWeight: 500 }}>Sharing active</span>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${p.border}` }}>
            <span style={{ display: 'block', fontSize: 12, color: p.sub, lineHeight: 1.5, marginBottom: 10 }}>
              Pull the latest feeds, nappies and medicines from the shared logbook.
            </span>
            <button
              onClick={handleResync}
              disabled={syncing}
              style={{
                ...secondaryBtn, marginTop: 0,
                background: syncDone ? `${brand.green}18` : 'transparent',
                borderColor: syncDone ? brand.green : p.border,
                color:       syncDone ? brand.green  : p.text,
                opacity: syncing ? 0.6 : 1,
                transition: 'all .3s',
              }}
            >
              {syncing ? 'Syncing…' : syncDone ? '✓ Up to date' : 'Sync now'}
            </button>
          </div>
        </Card>
      )}

      {/* ── Local-only notice when not logged in ── */}
      {!authUser && (
        <div style={{ margin: '0 14px 20px', padding: '12px 14px', borderRadius: 12, background: p.card, border: `1px solid ${p.border}` }}>
          <span style={{ fontSize: 12, color: p.sub, lineHeight: 1.5 }}>
            Without an account, all data is saved locally on this device only. Signing in is optional — the app works fully without it.
          </span>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  )
}
