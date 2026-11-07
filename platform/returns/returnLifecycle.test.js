'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { createReturn, transitionReturn, filingPermitted } = require('./returnLifecycle')
const ownerId = 'account_123'
const create = () => createReturn({year:2025,ownerId})
const move = (record,to,evidence) => transitionReturn(record,{to,actorId:ownerId,expectedRevision:record.revision,evidence})
test('new return starts as draft with audit history',()=>{const r=create();assert.equal(r.state,'draft');assert.equal(r.history.length,1)})
test('invalid year and owner rejected',()=>{assert.throws(()=>createReturn({year:2024,ownerId}));assert.throws(()=>createReturn({year:2025,ownerId:'!' }))})
test('review correction and approval path',()=>{let r=create();r=move(r,'in_review');r=move(r,'needs_correction');r=move(r,'draft');r=move(r,'in_review');r=move(r,'approved',{reference:'review-001'});assert.equal(r.revision,6)})
test('filing blocked without all gates',()=>{let r=move(create(),'in_review');r=move(r,'approved',{reference:'review-001'});assert.equal(filingPermitted(r,{}),false);assert.equal(filingPermitted(r,{identityVerified:true,taxRulesValidated:true,allFormsReconciled:true,taxpayerConsent:true,providerConfigured:true}),true)})
test('filing requires provider evidence',()=>{let r=move(move(create(),'in_review'),'approved',{reference:'review'});assert.throws(()=>move(r,'filed',{reference:'filing'}));r=move(r,'filed',{reference:'receipt',channel:'authorized_efile_provider'});assert.equal(r.state,'filed')})
test('revision conflicts, forbidden owner and invalid transitions rejected',()=>{const r=create();assert.throws(()=>move(r,'accepted'));assert.throws(()=>transitionReturn(r,{to:'in_review',actorId:'other',expectedRevision:1}));assert.throws(()=>transitionReturn(r,{to:'in_review',actorId:ownerId,expectedRevision:2}))})
test('acceptance requires evidence and amendment follows acceptance',()=>{let r=move(move(create(),'in_review'),'approved',{reference:'review'});r=move(r,'filed',{reference:'receipt',channel:'authorized_efile_provider'});assert.throws(()=>move(r,'accepted'));r=move(r,'accepted',{reference:'irs-ack'});r=move(r,'amended');assert.equal(r.state,'amended')})
