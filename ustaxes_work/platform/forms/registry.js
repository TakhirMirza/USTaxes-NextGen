'use strict'
const forms=Object.freeze({
  2025:{status:'pending',forms:[{id:'1040',officialUrl:'https://www.irs.gov/pub/irs-pdf/f1040.pdf',mapping:'not-validated'},{id:'1040-SR',officialUrl:'https://www.irs.gov/pub/irs-pdf/f1040s.pdf',mapping:'not-validated'}]},
  2026:{status:'pending',forms:[]},2027:{status:'unavailable',forms:[]},2028:{status:'unavailable',forms:[]}
})
function getFormRegistry(year){return forms[year]||{status:'unavailable',forms:[]}}
module.exports={getFormRegistry}
