import { useState } from 'react'
import SelectDriver from './screens/SelectDriver'
import StartTrip from './screens/StartTrip'
import PickUp from './screens/PickUp'
import DropOff from './screens/DropOff'
import Confirmation from './screens/Confirmation'

const SCREENS = {
  SELECT_DRIVER: 'SELECT_DRIVER',
  START_TRIP: 'START_TRIP',
  PICKUP: 'PICKUP',
  DROPOFF: 'DROPOFF',
  CONFIRMATION: 'CONFIRMATION',
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SELECT_DRIVER)
  const [driver, setDriver] = useState(null)
  const [trip, setTrip] = useState(null)

  function reset() {
    setScreen(SCREENS.SELECT_DRIVER)
    setDriver(null)
    setTrip(null)
  }

  if (screen === SCREENS.SELECT_DRIVER) {
    return (
      <SelectDriver
        onNext={(d) => {
          setDriver(d)
          setScreen(SCREENS.START_TRIP)
        }}
      />
    )
  }

  if (screen === SCREENS.START_TRIP) {
    return (
      <StartTrip
        driver={driver}
        onNext={(t) => {
          setTrip(t)
          setScreen(SCREENS.PICKUP)
        }}
        onBack={() => setScreen(SCREENS.SELECT_DRIVER)}
      />
    )
  }

  if (screen === SCREENS.PICKUP) {
    return (
      <PickUp
        driver={driver}
        trip={trip}
        onNext={(updatedTrip) => {
          setTrip(updatedTrip)
          setScreen(SCREENS.DROPOFF)
        }}
      />
    )
  }

  if (screen === SCREENS.DROPOFF) {
    return (
      <DropOff
        driver={driver}
        trip={trip}
        onNext={(completedTrip) => {
          setTrip(completedTrip)
          setScreen(SCREENS.CONFIRMATION)
        }}
      />
    )
  }

  if (screen === SCREENS.CONFIRMATION) {
    return <Confirmation driver={driver} trip={trip} onNewTrip={reset} />
  }

  return null
}
