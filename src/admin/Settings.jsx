import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FEATURES } from '../lib/features'

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

  // Differential pricing rules
  const [diffRules,      setDiffRules]      = useState([])
  const [diffLoading,    setDiffLoading]    = useState(false)
  const [diffForm,       setDiffForm]       = useState(null)   // null = closed, {} = new, {id,...} = editing
  const [diffSaving,     setDiffSaving]     = useState(false)
  const [diffError,      setDiffError]      = useState(null)
  const [deletingRuleId, setDeletingRuleId] = useState(null)

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  function emptyRule() {
    return { name: '', time_start: '', time_end: '', days: [], surcharge: '', active: true }
  }

  async function fetchDiffRules() {
    setDiffLoading(true)
    const { data } = await supabase.from('differential_rules').select('*').order('created_at')
    setDiffRules(data || [])
    setDiffLoading(false)
  }

  async function handleSaveDiffRule() {
    setDiffError(null)
    const hasTime = diffForm.time_start || diffForm.time_end
    const hasDays = diffForm.days.length > 0
    if (hasTime && (!diffForm.time_start || !diffForm.time_end)) {
      setDiffError('Both Time Start and Time End are required when setting a time window.')
      return
    }
    if (!hasTime && !hasDays) {
      setDiffError('At least one condition is required — set a time window, days of week, or both.')
      return
    }
    setDiffSaving(true)
    const payload = {
      name:       diffForm.name.trim(),
      time_start: diffForm.time_start || null,
      time_end:   diffForm.time_end   || null,
      days:       diffForm.days.length ? diffForm.days : null,
      surcharge:  parseFloat(diffForm.surcharge) || 0,
      active:     diffForm.active,
    }
    let err
    if (diffForm.id) {
      ;({ error: err } = await supabase.from('differential_rules').update(payload).eq('id', diffForm.id))
    } else {
      ;({ error: err } = await supabase.from('differential_rules').insert(payload))
    }
    if (err) {
      setDiffError(err.message)
    } else {
      setDiffForm(null)
      fetchDiffRules()
    }
    setDiffSaving(false)
  }

  async function handleDeleteDiffRule(id) {
    if (!confirm('Delete this rule?')) return
    setDeletingRuleId(id)
    await supabase.from('differential_rules').delete().eq('id', id)
    setDiffRules((prev) => prev.filter((r) => r.id !== id))
    setDeletingRuleId(null)
  }

  function toggleDay(dayIdx) {
    setDiffForm((prev) => {
      const days = prev.days.includes(dayIdx) ? prev.days.filter((d) => d !== dayIdx) : [...prev.days, dayIdx]
      return { ...prev, days }
    })
  }

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
    if (FEATURES.differential) fetchDiffRules()
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

      {/* Differential Pricing Rules */}
      {FEATURES.differential && (
        <div className="a-card" style={{ marginBottom: 20 }}>
          <div className="a-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Differential Pricing Rules</span>
            {!diffForm && (
              <button className="a-btn a-btn-primary a-btn-sm" onClick={() => setDiffForm(emptyRule())}>
                + Add Rule
              </button>
            )}
          </div>

          {/* Add / Edit form */}
          {diffForm && (
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
                {diffForm.id ? 'Edit Rule' : 'New Rule'}
              </div>
              {diffError && <p className="a-error">{diffError}</p>}
              <div className="a-field">
                <label>Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Evening / Night"
                  value={diffForm.name}
                  onChange={(e) => setDiffForm({ ...diffForm, name: e.target.value })}
                />
              </div>
              <div className="a-field-row">
                <div className="a-field">
                  <label>Time Start (24h, optional)</label>
                  <input
                    type="time"
                    value={diffForm.time_start}
                    onChange={(e) => setDiffForm({ ...diffForm, time_start: e.target.value })}
                  />
                </div>
                <div className="a-field">
                  <label>Time End (24h, optional)</label>
                  <input
                    type="time"
                    value={diffForm.time_end}
                    onChange={(e) => setDiffForm({ ...diffForm, time_end: e.target.value })}
                  />
                </div>
                <div className="a-field">
                  <label>Surcharge ($ per rider)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="2.00"
                    value={diffForm.surcharge}
                    onChange={(e) => setDiffForm({ ...diffForm, surcharge: e.target.value })}
                  />
                </div>
              </div>
              <div className="a-field">
                <label>Days of Week (optional — leave blank for any day)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {DAYS.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(i)}
                      style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                        border: '1.5px solid',
                        borderColor: diffForm.days.includes(i) ? '#1d4ed8' : '#cbd5e1',
                        background: diffForm.days.includes(i) ? '#dbeafe' : '#fff',
                        color: diffForm.days.includes(i) ? '#1d4ed8' : '#64748b',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="a-btn a-btn-primary"
                  onClick={handleSaveDiffRule}
                  disabled={diffSaving || !diffForm.name.trim() || !diffForm.surcharge}
                >
                  {diffSaving ? 'Saving…' : 'Save Rule'}
                </button>
                <button className="a-btn a-btn-ghost" onClick={() => { setDiffForm(null); setDiffError(null) }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Rule list */}
          <div style={{ padding: '12px 20px' }}>
            {diffLoading ? (
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading…</p>
            ) : diffRules.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No rules yet. Add one above.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>Time Window</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>Days</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>Surcharge</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>Status</th>
                    <th style={{ width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {diffRules.map((rule) => (
                    <tr key={rule.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 8px', fontWeight: 600 }}>{rule.name}</td>
                      <td style={{ padding: '9px 8px', color: '#475569' }}>
                        {rule.time_start && rule.time_end ? `${rule.time_start} – ${rule.time_end}` : '—'}
                      </td>
                      <td style={{ padding: '9px 8px', color: '#475569' }}>
                        {rule.days?.length ? rule.days.map((d) => DAYS[d]).join(', ') : '—'}
                      </td>
                      <td style={{ padding: '9px 8px', fontWeight: 700, color: '#15803d' }}>
                        +${Number(rule.surcharge).toFixed(2)}/rider
                      </td>
                      <td style={{ padding: '9px 8px' }}>
                        {rule.active
                          ? <span className="a-badge a-badge-green">Active</span>
                          : <span className="a-badge a-badge-gray">Inactive</span>}
                      </td>
                      <td style={{ padding: '9px 8px', display: 'flex', gap: 6 }}>
                        <button
                          className="a-btn a-btn-ghost a-btn-sm"
                          onClick={async () => {
                            await supabase.from('differential_rules').update({ active: !rule.active }).eq('id', rule.id)
                            setDiffRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, active: !r.active } : r))
                          }}
                        >
                          {rule.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="a-btn a-btn-ghost a-btn-sm"
                          onClick={() => setDiffForm({ ...rule, days: rule.days || [] })}
                        >
                          Edit
                        </button>
                        <button
                          className="a-btn a-btn-danger a-btn-sm"
                          onClick={() => handleDeleteDiffRule(rule.id)}
                          disabled={deletingRuleId === rule.id}
                        >
                          {deletingRuleId === rule.id ? '…' : 'Del'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

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
