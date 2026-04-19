import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './admin/AuthContext'

// Driver PWA screens
import SelectDriver from './screens/SelectDriver'
import ActiveTrips from './screens/ActiveTrips'
import StartTrip from './screens/StartTrip'
import PickUp from './screens/PickUp'
import DropOff from './screens/DropOff'
import Confirmation from './screens/Confirmation'

// Rider PWA
import RiderApp from './rider/RiderApp'

// Admin
import Login from './admin/Login'
import AdminLayout from './admin/AdminLayout'
import Dashboard from './admin/Dashboard'
import Trips from './admin/Trips'
import Riders from './admin/Riders'
import Drivers from './admin/Drivers'
import Reports from './admin/Reports'
import Invoices from './admin/Invoices'
import Incidents from './admin/Incidents'
import Settings from './admin/Settings'
import RidePool from './admin/RidePool'

import './admin/admin.css'

import { useState } from 'react'

const SCREENS = {
  SELECT_DRIVER: 'SELECT_DRIVER',
  ACTIVE_TRIPS:  'ACTIVE_TRIPS',
  START_TRIP:    'START_TRIP',
  PICKUP:        'PICKUP',
  DROPOFF:       'DROPOFF',
  CONFIRMATION:  'CONFIRMATION',
}

function DriverApp() {
  const [screen, setScreen] = useState(SCREENS.SELECT_DRIVER)
  const [driver, setDriver] = useState(null)
  const [trip,   setTrip]   = useState(null)

  function goToActiveTrips() {
    setTrip(null)
    setScreen(SCREENS.ACTIVE_TRIPS)
  }

  function handleContinueTrip(t) {
    setTrip(t)
    if (!t.pickup_timestamp) {
      setScreen(SCREENS.PICKUP)
    } else {
      setScreen(SCREENS.DROPOFF)
    }
  }

  if (screen === SCREENS.SELECT_DRIVER)
    return (
      <SelectDriver
        onNext={(d) => { setDriver(d); setScreen(SCREENS.ACTIVE_TRIPS) }}
      />
    )

  if (screen === SCREENS.ACTIVE_TRIPS)
    return (
      <ActiveTrips
        driver={driver}
        onNewTrip={() => setScreen(SCREENS.START_TRIP)}
        onContinueTrip={handleContinueTrip}
        onChangeDriver={() => { setDriver(null); setScreen(SCREENS.SELECT_DRIVER) }}
      />
    )

  if (screen === SCREENS.START_TRIP)
    return (
      <StartTrip
        driver={driver}
        onNext={goToActiveTrips}
        onBack={goToActiveTrips}
      />
    )

  if (screen === SCREENS.PICKUP)
    return (
      <PickUp
        driver={driver}
        trip={trip}
        onNext={goToActiveTrips}
        onBack={goToActiveTrips}
      />
    )

  if (screen === SCREENS.DROPOFF)
    return (
      <DropOff
        driver={driver}
        trip={trip}
        onNext={(t) => { setTrip(t); setScreen(SCREENS.CONFIRMATION) }}
        onBack={goToActiveTrips}
      />
    )

  if (screen === SCREENS.CONFIRMATION)
    return (
      <Confirmation
        driver={driver}
        trip={trip}
        onNewTrip={goToActiveTrips}
      />
    )

  return null
}

function AdminGuard({ children }) {
  const session = useAuth()
  if (session === undefined) return null
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
            <Route path="reports" element={<Reports />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="settings" element={<Settings />} />
            <Route path="ride-pool" element={<RidePool />} />
          </Route>
          <Route path="/rider" element={<RiderApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
