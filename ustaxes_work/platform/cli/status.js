'use strict'
const {listYears}=require('../rules/catalog')
console.log('USTaxes NextGen — year readiness (not IRS certification)')
for(const y of listYears())console.log(`${y.year}: ${y.status.padEnd(12)} ${y.reason}`)
