import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const LABELS = {
  company_name: 'Company Name',
  company_address: 'Company Address',
  company_city_state_zip: 'City, State, ZIP',
  company_phone: 'Company Phone',
  company_ein: 'EIN',
  invoice_payable_to: 'Invoice Payable To',
  invoice_for_dept: 'Invoice For — Department',
  invoice_for_org: 'Invoice For — Organization',
  invoice_for_address: 'Invoice For — Address',
  invoice_for_city_state_zip: 'Invoice For — City, State, ZIP',
  project_name: 'Project Name',
  rate_standard: 'Org Rate — Standard ($/ride)',
  rate_long_distance: 'Org Rate — Long Distance ($/ride)',
  long_distance_threshold_miles: 'Long Distance Threshold (miles)',
  rate_additional_rider: 'Org Rate — Additional Rider ($/rider)',
  rate_driver_pay: 'Driver Pay — Base ($/ride)',
  rate_driver_additional_rider: 'Driver Pay — Additional Rider ($/rider)',
  admin_email: 'Admin Email (weekly delivery)',
  report_recipient_1: 'Report Recipient 1 (email)',
  report_recipient_2: 'Report Recipient 2 (email)',
  report_recipient_3: 'Report Recipient 3 (email)',
}

const GROUPS = [
  {
    title: 'Company Info',
    keys: ['company_name', 'company_address', 'company_city_state_zip', 'company_phone', 'company_ein'],
  },
  {
    title: 'Invoice Details',
    keys: ['invoice_payable_to', 'invoice_for_dept', 'invoice_for_org', 'invoice_for_address', 'invoice_for_city_state_zip', 'project_name'],
  },
  {
    title: 'Rates',
    keys: ['rate_standard', 'rate_long_distance', 'long_distance_threshold_miles', 'rate_additional_rider', 'rate_driver_pay', 'rate_driver_additional_rider'],
  },
  {
    title: 'General',
    keys: ['admin_email'],
  },
  {
    title: 'Weekly Report Recipients',
    keys: ['report_recipient_1', 'report_recipient_2', 'report_recipient_3'],
  },
]

const PRIVATE_LABELS = {
  resend_api_key:    'Resend API Key',
  resend_from_email: 'From Email (must be verified domain at resend.com)',
  resend_reply_to:   'Reply-To Email',
}

export default function Settings() {
  const [values,   setValues]   = useState({})
  const [original, setOriginal] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState(null)

  // Private (notification) settings
  const [priv,        setPriv]        = useState({})
  const [privOriginal,setPrivOriginal]= useState({})
  const [privSaving,  setPrivSaving]  = useState(false)
  const [privSaved,   setPrivSaved]   = useState(false)
  const [privError,   setPrivError]   = useState(null)
  const [showKey,     setShowKey]     = useState(false)

  // Admin user creation
  const [newEmail,    setNewEmail]    = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showNewPw,   setShowNewPw]   = useState(false)
  const [userSaving,  setUserSaving]  = useState(false)
  const [userSaved,   setUserSaved]   = useState(false)
  const [userError,   setUserError]   = useState(null)

  // Admin user list
  const [adminUsers,     setAdminUsers]     = useState([])
  const [usersLoading,   setUsersLoading]   = useState(false)
  const [deletingId,     setDeletingId]     = useState(null)
  const [deleteError,    setDeleteError]    = useState(null)
  const [currentUserId,  setCurrentUserId]  = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('settings').select('key, value'),
      supabase.from('private_settings').select('key, value'),
      supabase.auth.getSession(),
    ]).then(([pub, prv, sessionResult]) => {
      const m = {}
      ;(pub.data || []).forEach((r) => (m[r.key] = r.value))
      setValues(m)
      setOriginal(m)

      const p = {}
      ;(prv.data || []).forEach((r) => (p[r.key] = r.value))
      setPriv(p)
      setPrivOriginal(p)

      const uid = sessionResult.data?.session?.user?.id
      setCurrentUserId(uid)

      setLoading(false)
    })
  }, [])

  async function fetchAdminUsers() {
    setUsersLoading(true)
    setDeleteError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await supabase.functions.invoke('manage-admin-users', {
      method: 'GET',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (!resp.error && resp.data?.users) {
      setAdminUsers(resp.data.users)
    }
    setUsersLoading(false)
  }

  async function handleDeleteUser(userId) {
    if (!confirm('Are you sure you want to delete this admin? This cannot be undone.')) return
    setDeletingId(userId)
    setDeleteError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await supabase.functions.invoke('manage-admin-users', {
      method: 'DELETE',
      body: { userId },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (resp.error || resp.data?.error) {
      setDeleteError(resp.data?.error || resp.error?.message || 'Failed to delete user')
    } else {
      setAdminUsers((prev) => prev.filter((u) => u.id !== userId))
    }
    setDeletingId(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const results = await Promise.all(
      Object.entries(values).map(([key, value]) =>
        supabase.from('settings').upsert({ key, value })
      )
    )
    const err = results.find((r) => r.error)
    if (err) {
      setError(err.error.message)
    } else {
      setOriginal({ ...values })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function handlePrivSave() {
    setPrivSaving(true)
    setPrivError(null)
    setPrivSaved(false)
    const results = await Promise.all(
      Object.entries(priv).map(([key, value]) =>
        supabase.from('private_settings').upsert({ key, value })
      )
    )
    const err = results.find((r) => r.error)
    if (err) {
      setPrivError(err.error.message)
    } else {
      setPrivOriginal({ ...priv })
      setPrivSaved(true)
      setTimeout(() => setPrivSaved(false), 3000)
    }
    setPrivSaving(false)
  }

  async function handleCreateUser() {
    setUserSaving(true)
    setUserError(null)
    setUserSaved(false)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await supabase.functions.invoke('create-admin-user', {
      body: { email: newEmail.trim(), password: newPassword },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (resp.error || resp.data?.error) {
      setUserError(resp.data?.error || resp.error?.message || 'Failed to create user')
    } else {
      setUserSaved(true)
      setNewEmail('')
      setNewPassword('')
      setTimeout(() => setUserSaved(false), 4000)
      fetchAdminUsers()
    }
    setUserSaving(false)
  }

  const isDirty     = JSON.stringify(values) !== JSON.stringify(original)
  const isPrivDirty = JSON.stringify(priv)   !== JSON.stringify(privOriginal)

  if (loading) return <p style={{ color: '#94a3b8', padding: 32 }}>Loading…</p>

  return (
    <div>
      <div className="a-page-header">
        <h1>Settings</h1>
        <button
          className="a-btn a-btn-primary"
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {error && <p className="a-error" style={{ marginBottom: 16 }}>{error}</p>}

      {GROUPS.map((group) => (
        <div key={group.title} className="a-card" style={{ marginBottom: 20 }}>
          <div className="a-card-header">{group.title}</div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {group.keys.map((key) => (
              <div key={key} className="a-field">
                <label>{LABELS[key] || key}</label>
                <input
                  type={key.includes('email') ? 'email' : 'text'}
                  value={values[key] ?? ''}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Notification / Email settings (private) */}
      <div className="a-card" style={{ marginBottom: 20 }}>
        <div className="a-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Notification Settings</span>
          <button
            className="a-btn a-btn-primary a-btn-sm"
            onClick={handlePrivSave}
            disabled={privSaving || !isPrivDirty}
          >
            {privSaving ? 'Saving…' : privSaved ? '✓ Saved' : 'Save'}
          </button>
        </div>
        <div style={{ padding: '16px 20px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: '0.82rem', color: '#92400e' }}>
          These values are private (admin-only). The <strong>From Email</strong> must be a domain verified at{' '}
          <a href="https://resend.com" target="_blank" rel="noreferrer" style={{ color: '#92400e' }}>resend.com</a>.
          Currently using <code>onboarding@resend.dev</code> which works without verification.
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {privError && <p className="a-error">{privError}</p>}
          {Object.keys(PRIVATE_LABELS).map((key) => (
            <div key={key} className="a-field">
              <label>{PRIVATE_LABELS[key]}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={key === 'resend_api_key' && !showKey ? 'password' : 'text'}
                  value={priv[key] ?? ''}
                  onChange={(e) => setPriv({ ...priv, [key]: e.target.value })}
                  style={{ paddingRight: key === 'resend_api_key' ? 72 : 14 }}
                />
                {key === 'resend_api_key' && (
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.8rem', color: '#64748b', fontWeight: 600,
                    }}
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin User Registration */}
      <div className="a-card" style={{ marginBottom: 20 }}>
        <div className="a-card-header">Add Admin User</div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {userError && <p className="a-error">{userError}</p>}
          {userSaved && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', color: '#15803d', fontWeight: 600, fontSize: '0.9rem' }}>
              ✓ Admin user created successfully
            </div>
          )}
          <div className="a-field">
            <label>Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="newadmin@example.com"
            />
          </div>
          <div className="a-field">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                style={{ paddingRight: 72 }}
              />
              <button
                type="button"
                onClick={() => setShowNewPw((v) => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.8rem', color: '#64748b', fontWeight: 600,
                }}
              >
                {showNewPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button
            className="a-btn a-btn-primary"
            onClick={handleCreateUser}
            disabled={userSaving || !newEmail.trim() || newPassword.length < 8}
            style={{ alignSelf: 'flex-start' }}
          >
            {userSaving ? 'Creating…' : 'Create Admin User'}
          </button>
        </div>
      </div>

      {/* Existing Admin Users */}
      <div className="a-card" style={{ marginBottom: 20 }}>
        <div className="a-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Existing Admin Users</span>
          <button
            className="a-btn a-btn-ghost a-btn-sm"
            onClick={fetchAdminUsers}
            disabled={usersLoading}
          >
            {usersLoading ? 'Loading…' : adminUsers.length === 0 ? 'Load Users' : 'Refresh'}
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          {deleteError && <p className="a-error" style={{ marginBottom: 12 }}>{deleteError}</p>}
          {adminUsers.length === 0 && !usersLoading && (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Click "Load Users" to see existing admins.</p>
          )}
          {adminUsers.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600 }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600 }}>Added</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600 }}>Last Sign In</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 10px' }}>
                      {u.email}
                      {u.id === currentUserId && (
                        <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>You</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px', color: '#64748b' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 10px', color: '#64748b' }}>
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      {u.id !== currentUserId && (
                        <button
                          className="a-btn a-btn-danger a-btn-sm"
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={deletingId === u.id}
                        >
                          {deletingId === u.id ? '…' : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
