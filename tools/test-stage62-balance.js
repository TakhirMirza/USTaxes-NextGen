const assert = require('node:assert/strict')
const { review2025Form1040Balance } = require(process.argv[2])
const integrated = { year:2025, filingReady:false, postingAuthorized:false,
 officialLines:{'13b':null,'19':null,'28':null,'34':null,'37':null},
 provisionalLine16:{kind:'unverified-import-candidate',tax:4000,filingReady:false},
 candidateNonrefundableCredit:500,candidateRefundableCredit:200,withholdingForReviewOnly:3000,blockers:[] }
const input = {integrated,otherNonrefundableCredits:100,otherTaxes:50,otherPayments:500,creditOrderingConfirmed:true,otherTaxesReviewed:true,paymentsAndWithholdingReviewed:true}
let n=0
function check(name, fn){fn(); n++; console.log('PASS',name)}
check('reconciled balance',()=>{const r=review2025Form1040Balance(input);assert.equal(r.candidates.line24TotalTax,3450);assert.equal(r.candidates.line33TotalPayments,3700);assert.equal(r.candidates.line34Overpayment,250);assert.equal(r.candidates.line37AmountOwed,0);assert.equal(r.postingAuthorized,false)})
check('amount owed',()=>{const r=review2025Form1040Balance({...input,integrated:{...integrated,withholdingForReviewOnly:1000},otherPayments:0});assert.equal(r.candidates.line37AmountOwed,2250)})
check('missing data blocks total',()=>{const r=review2025Form1040Balance({...input,otherPayments:null});assert.equal(r.candidates.line33TotalPayments,null)})
check('excess credit blocked',()=>{const r=review2025Form1040Balance({...input,integrated:{...integrated,candidateNonrefundableCredit:5000}});assert.equal(r.candidates.line22TaxAfterCredits,null)})
check('negative amount rejected',()=>assert.throws(()=>review2025Form1040Balance({...input,otherTaxes:-1})))
check('unsafe upstream rejected',()=>assert.throws(()=>review2025Form1040Balance({...input,integrated:{...integrated,postingAuthorized:true}})))
console.log(`${n}/${n} passed`)
