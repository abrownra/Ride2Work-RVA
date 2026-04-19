import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/trips', label: 'Trips', icon: '🚗' },
  { to: '/admin/riders', label: 'Riders', icon: '👥' },
  { to: '/admin/drivers', label: 'Drivers', icon: '🧑‍✈️' },
  { to: '/admin/reports', label: 'Reports', icon: '📋' },
  { to: '/admin/invoices', label: 'Invoices', icon: '🧾' },
  { to: '/admin/ride-pool', label: 'Ride Pool', icon: '🚦' },
  { to: '/admin/incidents', label: 'Incidents', icon: '⚠️' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/admin')
  }

  return (
    <div className="a-shell">
      <aside className="a-sidebar">
        <div className="a-sidebar-brand">Ride to Work RVA</div>
        <nav className="a-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `a-nav-link${isActive ? ' active' : ''}`}
            >
              <span className="a-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="a-signout" onClick={handleSignOut}>Sign Out</button>
      </aside>

      {/* Mobile top bar */}
      <div className="a-topbar">
        <span className="a-topbar-brand">Ride to Work Admin</span>
        <button className="a-signout-sm" onClick={handleSignOut}>Sign Out</button>
      </div>

      {/* Mobile bottom nav */}
      <nav className="a-bottom-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `a-bottom-link${isActive ? ' active' : ''}`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <main className="a-main">
        <Outlet />
      </main>
    </div>
  )
}
