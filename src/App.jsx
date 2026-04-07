import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './admin/AuthContext'

// Driver PWA screens
import SelectDriver from './screens/SelectDriver'
import StartTrip from './screens/StartTrip'
import PickUp from './screens/PickUp'
import DropOff from './screens/DropOff'
import Confirmation from './screens/Confirmation'

// Admin
import Login from './admin/Login'
import AdminLayout from './admin/AdminLayout'
import Dashboard from './admin/Dashboard'
import Trips from './admin/Trips'
import Riders from './admin/Riders'
import Drivers from './admin/Drivers'
import Invoices from './admin/Invoices'
import Settings from './admin/Settings'

import './admin/admin.css'

import { useState } from 'react'

const SCREENS = {
  SELECT_DRIVER: 'SELECT_DRIVER',
  START_TRIP: 'START_TRIP',
  PICKUP: 'PICKUP',
  DROPOFF: 'DROPOFF',
  CONFIRMATION: 'CONFIRMATION',
}

function DriverApp() {
  const [screen, setScreen] = useState(SCREENS.SELECT_DRIVER)
  const [driver, setDriver] = useState(null)
  const [trip, setTrip] = useState(null)

  function reset() {
    setScreen(SCREENS.SELECT_DRIVER)
    setDriver(null)
    setTrip(null)
  }

  if (screen === SCREENS.SELECT_DRIVER)
    return <SelectDriver onNext={(d) => { setDriver(d); setScreen(SCREENS.START_TRIP) }} />

  if (screen === SCREENS.START_TRIP)
    return <StartTrip driver={driver} onNext={(t) => { setTrip(t); setScreen(SCREENS.PICKUP) }} onBack={() => setScreen(SCREENS.SELECT_DRIVER)} />

  if (screen === SCREENS.PICKUP)
    return <PickUp driver={driver} trip={trip} onNext={(t) => { setTrip(t); setScreen(SCREENS.DROPOFF) }} />

  if (screen === SCREENS.DROPOFF)
    return <DropOff driver={driver} trip={trip} onNext={(t) => { setTrip(t); setScreen(SCREENS.CONFIRMATION) }} />

  if (screen === SCREENS.CONFIRMATION)
    return <Confirmation driver={driver} trip={trip} onNewTrip={reset} />

  return null
}

function AdminGuard({ children }) {
  const session = useAuth()
  if (session === undefined) return null // loading
  if (!session) return <Login />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DriverApp />} />
          <Route
            path="/admin"
            element={
              <AdminGuard>
                <AdminLayout />
              </AdminGuard>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="trips" element={<Trips />} />
            <Route path="riders" element={<Riders />} />
            <Route path="drivers" element={<Drivers />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
