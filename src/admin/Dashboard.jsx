import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function getWeekBounds() {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday.toISOString(), end: sunday.toISOString() }
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [byDriver, setByDriver] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { start, end } = getWeekBounds()

      const { data: trips } = await supabase
        .from('trips')
        .select('id, rider_count, trip_total, driver_id, status, drivers(name)')
        .eq('status', 'completed')
        .gte('created_at', start)
        .lte('created_at', end)

      const { data: allTrips } = await supabase
        .from('trips')
        .select('id')
        .eq('status', 'completed')

      const t = trips || []
      const totalRides = t.length
      const totalRiders = t.reduce((s, r) => s + (r.rider_count || 1), 0)
      const totalAmount = t.reduce((s, r) => s + (r.trip_total || 0), 0)

      // Group by driver
      const map = {}
      t.forEach((trip) => {
        const name = trip.drivers?.name || 'Unknown'
        if (!map[name]) map[name] = { rides: 0, amount: 0 }
        map[name].rides += 1
        map[name].amount += trip.trip_total || 0
      })
      const driverRows = Object.entries(map)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.rides - a.rides)

      setStats({ totalRides, totalRiders, totalAmount, allTime: (allTrips || []).length })
      setByDriver(driverRows)
      setLoading(false)
    }
    load()
  }, [])

  const maxRides = byDriver.length ? Math.max(...byDriver.map((d) => d.rides)) : 1

  return (
    <div>
      <div className="a-page-header">
        <h1>Dashboard</h1>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>This Week</span>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading…</p>
      ) : (
        <>
          <div className="a-stat-grid">
            <div className="a-stat-card">
              <div className="a-stat-label">Rides This Week</div>
              <div className="a-stat-val">{stats.totalRides}</div>
            </div>
            <div className="a-stat-card">
              <div className="a-stat-label">Riders This Week</div>
              <div className="a-stat-val">{stats.totalRiders}</div>
            </div>
            <div className="a-stat-card">
              <div className="a-stat-label">Amount This Week</div>
              <div className="a-stat-val">${stats.totalAmount.toFixed(2)}</div>
            </div>
            <div className="a-stat-card">
              <div className="a-stat-label">All-Time Rides</div>
              <div className="a-stat-val">{stats.allTime}</div>
            </div>
          </div>

          <div className="a-card">
            <div className="a-card-header">Rides by Driver — This Week</div>
            {byDriver.length === 0 ? (
              <p className="a-empty">No completed trips this week</p>
            ) : (
              <div className="a-bar-chart">
                {byDriver.map((d) => (
                  <div key={d.name} className="a-bar-row">
                    <span className="a-bar-name" title={d.name}>{d.name}</span>
                    <div className="a-bar-track">
                      <div
                        className="a-bar-fill"
                        style={{ width: `${(d.rides / maxRides) * 100}%` }}
                      />
                    </div>
                    <span className="a-bar-val">{d.rides} · ${d.amount.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
