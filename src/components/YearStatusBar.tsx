import { Link } from '@material-ui/core'
import { ReactElement, useState } from 'react'
import { useSelector } from 'react-redux'
import { YearsTaxesState } from 'ustaxes/redux'
import { TaxYears } from 'ustaxes/core/data'
import YearDropDown from './YearDropDown'
import { Link as RouterLink } from 'react-router-dom'

const YearStatusBar = (): ReactElement => {
  const year = useSelector((state: YearsTaxesState) => state.activeYear)
  const [isOpen, setOpen] = useState(false)

  const openButton = (
    <Link
      href=""
      data-testid="year-dropdown-button"
      onClick={(e) => {
        e.preventDefault()
        setOpen(true)
      }}
    >
      {TaxYears[year]}
    </Link>
  )

  return (
    <div>
      <h3>Legacy tax editor — {isOpen ? TaxYears[year] : openButton} (not verified for filing)</h3>
      <p><RouterLink to="/nextgen/2025/review">2025 diagnostic review (development only)</RouterLink></p>
      {isOpen ? <YearDropDown onDone={() => setOpen(false)} /> : undefined}
    </div>
  )
}

export default YearStatusBar
