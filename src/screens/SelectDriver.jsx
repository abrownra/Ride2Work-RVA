import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SelectDriver({ onNext }) {
  const [drivers, setDrivers] = useState([])
  const [driverId, setDriverId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('drivers')
      .select('id, name')
      .eq('active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setDrivers(data || [])
        setLoading(false)
      })
  }, [])

  const selectedDriver = drivers.find((d) => d.id === driverId)

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Ride2Work RVA</h1>
        <p>Free Rides To Work — Driver App</p>
      </div>

      <div className="screen-body">
        {error && <p className="error-msg">{error}</p>}

        <div className="field">
          <label>Select Your Name</label>
          {loading ? (
            <p style={{ color: 'var(--gray-400)', fontSize: '0.95rem' }}>Loading drivers…</p>
          ) : (
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">— Choose driver —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          className="btn btn-primary"
          disabled={!driverId}
          onClick={() => onNext(selectedDriver)}
          style={{ marginTop: 'auto' }}
        >
          Start Trip →
        </button>
      </div>
    </div>
  )
}
