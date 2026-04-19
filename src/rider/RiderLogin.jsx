import { useState } from 'react'
import { supabase } from '../lib/supabase'

function normalizePhone(p) {
  return (p || '').replace(/\D/g, '')
}

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length < 4) return digits
  if (digits.length < 7) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

export default function RiderLogin({ onLogin }) {
  const [name, setName]   = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!name.trim() || !phone.trim()) {
      setError('Please enter your name and phone number.')
      return
    }
    setLoading(true)
    setError(null)

    const { data: riders } = await supabase
      .from('riders')
      .select('*')
      .eq('active', true)
      .ilike('name', name.trim())

    const match = (riders || []).find(
      (r) => normalizePhone(r.phone) === normalizePhone(phone)
    )

    if (!match) {
      setError("We couldn't find an account with that name and phone number. Contact your coordinator if you need help.")
      setLoading(false)
      return
    }

    localStorage.setItem('rider_session', JSON.stringify(match))
    onLogin(match)
    setLoading(false)
  }

  return (
    <div className="screen">
      <div className="screen-header" style={{ background: '#111111' }}>
        <h1>Rider Portal</h1>
        <p>Free Rides to Work</p>
      </div>

      <div className="screen-body">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>🚗</div>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.95rem' }}>
            Sign in to request and manage your rides.
          </p>
        </div>

        <div className="field">
          <label>Your Name</label>
          <input
            type="text"
            placeholder="First and last name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div className="field">
          <label>Phone Number</label>
          <input
            type="tel"
            placeholder="(804) 555-1234"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button
          className="btn btn-primary"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : 'Sign In'}
        </button>
      </div>
    </div>
  )
}
