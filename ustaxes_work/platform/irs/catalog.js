'use strict'
/** Official publication links are candidate resources, not an authenticated API. */
const BASE='https://www.irs.gov'
const documents=Object.freeze([
 {id:'form1040',path:'/pub/irs-pdf/f1040.pdf',description:'Current Form 1040; URL is not year-pinned'},
 {id:'instructions1040',path:'/pub/irs-pdf/i1040gi.pdf',description:'Current Form 1040 instructions; URL is not year-pinned'},
 {id:'schedule1',path:'/pub/irs-pdf/f1040s1.pdf',description:'Current Schedule 1; URL is not year-pinned'}
])
module.exports={BASE,documents}
