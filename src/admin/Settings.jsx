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
  rate_standard: 'Standard Rate ($/ride)',
  rate_long_distance: 'Long Distance Rate ($/ride)',
  long_distance_threshold_miles: 'Long Distance Threshold (miles)',
  admin_email: 'Admin Email (for weekly invoice delivery)',
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
    keys: ['rate_standard', 'rate_long_distance', 'long_distance_threshold_miles'],
  },
  {
    title: 'Notifications',
    keys: ['admin_email'],
  },
]

export default function Settings() {
  const [values, setValues] = useState({})
  const [original, setOriginal] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('settings')
      .select('key, value')
      .then(({ data }) => {
        const m = {}
        ;(data || []).forEach((r) => (m[r.key] = r.value))
        setValues(m)
        setOriginal(m)
        setLoading(false)
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const updates = Object.entries(values).map(([key, value]) =>
      supabase.from('settings').upsert({ key, value })
    )

    const results = await Promise.all(updates)
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

  const isDirty = JSON.stringify(values) !== JSON.stringify(original)

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
    </div>
  )
}
