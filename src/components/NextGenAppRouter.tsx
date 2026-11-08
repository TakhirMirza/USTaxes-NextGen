import { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import NextGenV2Foundation from './NextGenV2Foundation'

/** Independent NextGen 2.0 routing boundary. Legacy forms are not mounted. */
export default function NextGenAppRouter(): ReactElement {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/start" replace />} />
      <Route path="/start" element={<NextGenV2Foundation />} />
      <Route path="/v2/*" element={<NextGenV2Foundation />} />
      <Route path="/nextgen-2/*" element={<Navigate to="/start" replace />} />
      <Route path="*" element={<Navigate to="/start" replace />} />
    </Routes>
  )
}
