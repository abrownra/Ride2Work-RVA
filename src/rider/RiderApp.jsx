import { useState, useEffect } from 'react'
import RiderLogin from './RiderLogin'
import RiderDashboard from './RiderDashboard'
import RiderRequestRide from './RiderRequestRide'
import RiderRideDetail from './RiderRideDetail'
import RiderMyRides from './RiderMyRides'

const SCREENS = {
  LOGIN:     'LOGIN',
  DASHBOARD: 'DASHBOARD',
  REQUEST:   'REQUEST',
  MY_RIDES:  'MY_RIDES',
  DETAIL:    'DETAIL',
}

export default function RiderApp() {
  const [screen, setScreen] = useState(SCREENS.LOGIN)
  const [rider,  setRider]  = useState(null)
  const [selectedRide, setSelectedRide] = useState(null)

  // Restore session from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rider_session')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.id) {
          setRider(parsed)
          setScreen(SCREENS.DASHBOARD)
        }
      }
    } catch { /* ignore */ }
  }, [])

  function handleLogin(r) {
    setRider(r)
    setScreen(SCREENS.DASHBOARD)
  }

  function handleLogout() {
    localStorage.removeItem('rider_session')
    setRider(null)
    setScreen(SCREENS.LOGIN)
  }

  function handleRequestSuccess() {
    setScreen(SCREENS.DASHBOARD)
  }

  function handleDetail(ride) {
    setSelectedRide(ride)
    setScreen(SCREENS.DETAIL)
  }

  function handleCancelled() {
    setScreen(SCREENS.DASHBOARD)
  }

  if (screen === SCREENS.LOGIN)
    return <RiderLogin onLogin={handleLogin} />

  if (screen === SCREENS.DASHBOARD)
    return (
      <RiderDashboard
        rider={rider}
        onRequest={() => setScreen(SCREENS.REQUEST)}
        onMyRides={() => setScreen(SCREENS.MY_RIDES)}
        onDetail={handleDetail}
        onLogout={handleLogout}
      />
    )

  if (screen === SCREENS.REQUEST)
    return (
      <RiderRequestRide
        rider={rider}
        onSuccess={handleRequestSuccess}
        onBack={() => setScreen(SCREENS.DASHBOARD)}
      />
    )

  if (screen === SCREENS.MY_RIDES)
    return (
      <RiderMyRides
        rider={rider}
        onSuccess={handleRequestSuccess}
        onBack={() => setScreen(SCREENS.DASHBOARD)}
      />
    )

  if (screen === SCREENS.DETAIL)
    return (
      <RiderRideDetail
        ride={selectedRide}
        onBack={() => setScreen(SCREENS.DASHBOARD)}
        onCancelled={handleCancelled}
      />
    )

  return null
}
