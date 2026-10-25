import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import YAML from 'yaml';
const data=JSON.parse(fs.readFileSync(new URL('../examples/connected-demonstrations.json',import.meta.url)));
const concepts=new Map(fs.readdirSync(new URL('..',import.meta.url)).filter(p=>p.endsWith('.meaning.yaml')).flatMap(p=>YAML.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')).concepts).map(c=>[c.id,c]));
const expected='team organizational-unit contact-point place address time-zone product service payment payment-obligation financial-account contract asset shipment project task event reservation document observation'.split(' ');
function validate(d){
 const records=new Map();
 for(const r of d.records){assert(!records.has(r.id),'duplicate record');records.set(r.id,r);assert.equal(concepts.get(r.entity)?.kind,'entity','record entity');}
 for(const e of expected)assert(d.records.some(r=>r.entity===e),`missing ${e}`);
 for(const r of d.records)for(const [id,v]of Object.entries(r.properties)){
  const c=concepts.get(id);assert(c,`unknown property ${id}`);assert.equal(c.kind,'attribute');assert.equal(c.of,r.entity,`property owner ${id}`);
  if(c['values-of']){assert(v&&typeof v==='object'&&Object.keys(v).length===1&&typeof v.ref==='string',`typed reference ${id}`);const target=records.get(v.ref);assert(target,`unresolved reference ${v.ref}`);assert.equal(target.entity,c['values-of'],`reference type ${id}`);}
  else {assert(['string','number','boolean'].includes(typeof v),`example scalar ${id}`);if(c.extends==='money-amount')assert(Number.isFinite(v)&&v>=0,`money ${id}`);}
 }
 const p=id=>records.get(id).properties;
 const reconciliation=d.purchaseReconciliation;
 const invoice=p(reconciliation.invoice),payment=p(reconciliation.payment),obligation=p(reconciliation.remainingObligation);
 assert.equal(invoice['invoice-total'],obligation['payment-obligation-amount']);
 assert.equal(invoice['invoice-total']-payment['payment-amount'],obligation['payment-obligation-outstanding-amount'],'remaining money');
 assert.equal(payment['payment-related-obligation'].ref,reconciliation.remainingObligation);
 assert.equal(obligation['payment-obligation-invoice'].ref,reconciliation.invoice,'obligation identifies reconciled invoice');
 for(const v of [payment['payment-currency'],obligation['payment-obligation-currency']])assert.deepEqual(v,invoice['invoice-currency'],'same recorded currency');
 const evt=p('EVT-REPAIR-DAY'),res=p('RES-HALL');
 assert(res['reservation-start']<=evt['event-start']&&res['reservation-end']>=evt['event-end'],'reservation covers event');
 assert(evt['event-start']<evt['event-end'],'positive event interval');
 assert.equal(res['reservation-event'].ref,'EVT-REPAIR-DAY','reservation identifies event');
 assert.equal(evt['event-asset'].ref,'ASSET-P17','event uses shared asset');
 assert.equal(p('TASK-LAMP')['task-asset'].ref,'ASSET-P17','maintenance uses shared asset');
 assert.equal(p('SHIP-104')['shipment-asset'].ref,'ASSET-P17','purchase shipment carries shared asset');
 assert.deepEqual(res['reservation-time-zone'],evt['event-time-zone']);assert.deepEqual(res['reservation-place'],evt['event-place']);
 assert.equal(p('TZ-DUBLIN')['time-zone-identifier'],'Europe/Dublin');
 for(const journey of Object.values(d.journeys)){for(const id of journey)assert(records.has(id),'journey reference');assert(journey.includes('ASSET-P17'),'shared asset identity');}
 assert.equal(p('TASK-LAMP')['task-observation'].ref,'OBS-LAMP');
 assert.deepEqual(p('OBS-LAMP')['observation-subject-asset'],p('TASK-LAMP')['task-asset']);
 assert.deepEqual(p('DOC-SERVICE')['document-subject-asset'],p('TASK-LAMP')['task-asset']);
 assert.equal(p('TASK-LAMP')['task-evidence-document'].ref,'DOC-SERVICE');assert.equal(p('DOC-SERVICE')['document-revision'],'A');
 assert.equal(p('OBS-LAMP')['observation-unit'],'hours','lamp observation unit');
 assert.equal(p('OBS-LAMP')['observation-value'],1980);assert.match(p('OBS-LAMP')['observation-description'],/advisory service interval 2000/);
}
test('connected examples retain semantic identities and business invariants',()=>validate(data));
for(const [name,mutate]of [
 ['dangling reference',d=>d.records.find(r=>r.id==='ASSET-P17').properties['asset-product']={ref:'MISSING'}],
 ['wrong reference type',d=>d.records.find(r=>r.id==='ASSET-P17').properties['asset-product']={ref:'PERSON-MAYA'}],
 ['wrong property owner',d=>d.records.find(r=>r.id==='TEAM-AV').properties['asset-name']='wrong'],
 ['negative money',d=>d.records.find(r=>r.id==='PAY-104').properties['payment-amount']=-700],
 ['incorrect balance',d=>d.records.find(r=>r.id==='OBL-104').properties['payment-obligation-outstanding-amount']=400],
 ['mixed currency',d=>{d.records.push({id:'GBP',entity:'currency',properties:{}});d.records.find(r=>r.id==='PAY-104').properties['payment-currency']={ref:'GBP'};}],
 ['uncovered event',d=>d.records.find(r=>r.id==='RES-HALL').properties['reservation-start']='2026-11-14T11:00:00'],
 ['different observed asset',d=>{d.records.push({id:'OTHER-ASSET',entity:'asset',properties:{}});d.records.find(r=>r.id==='OBS-LAMP').properties['observation-subject-asset']={ref:'OTHER-ASSET'};}],
 ['wrong observation unit',d=>d.records.find(r=>r.id==='OBS-LAMP').properties['observation-unit']='kg'],
 ['unrelated reconciled invoice',d=>{d.records.push({id:'OTHER-INV',entity:'invoice',properties:{}});d.records.find(r=>r.id==='OBL-104').properties['payment-obligation-invoice']={ref:'OTHER-INV'};}],
 ['different event asset',d=>{d.records.push({id:'OTHER-ASSET',entity:'asset',properties:{}});d.records.find(r=>r.id==='EVT-REPAIR-DAY').properties['event-asset']={ref:'OTHER-ASSET'};}],
 ['different reservation event',d=>{d.records.push({id:'OTHER-EVENT',entity:'event',properties:{}});d.records.find(r=>r.id==='RES-HALL').properties['reservation-event']={ref:'OTHER-EVENT'};}],
 ['different shipped asset',d=>{d.records.push({id:'OTHER-ASSET',entity:'asset',properties:{}});d.records.find(r=>r.id==='SHIP-104').properties['shipment-asset']={ref:'OTHER-ASSET'};}],
 ['missing journey identity',d=>d.journeys.maintenance=d.journeys.maintenance.filter(id=>id!=='ASSET-P17')]
])test(`rejects ${name}`,()=>{const broken=structuredClone(data);mutate(broken);assert.throws(()=>validate(broken));});
