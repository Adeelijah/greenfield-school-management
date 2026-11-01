// Pure NGN finance policy. No SDK, connection, environment or persistence.
// Callers must supply complete, server-verified current authority and locked rows.
export const maximumKobo=999_999_999_999;
const money=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=maximumKobo;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const day=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const version=(v:unknown):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>0&&v<2147483647;
/** Decimal text only; amounts never pass through floating-point naira. */
export function parseNairaToKobo(raw:unknown):number|null{
 if(typeof raw!=='string'||raw.length>32)return null;
 const text=raw.trim();if(!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(text))return null;
 const [whole,fraction='']=text.split('.'),value=BigInt(whole!)*BigInt(100)+BigInt(fraction.padEnd(2,'0'));
 return value<=BigInt(maximumKobo)?Number(value):null;
}
export function formatKobo(value:number):string{
 if(!money(value))throw Error('Invalid minor-unit amount');
 return String(Math.floor(value/100))+'.'+String(value%100).padStart(2,'0');
}
export type FinanceActor={authUserId:string;membershipId:string;schoolId:string;role:'admin'|'bursar'|'teacher';status:'active'|'suspended';activeMembershipCount:number;schoolUserCount:number};
function authorized(actor:FinanceActor,schoolId:string,adminOnly=false):boolean{
 return !!actor&&id(actor.authUserId)&&id(actor.membershipId)&&id(actor.schoolId)&&actor.schoolId===schoolId&&actor.status==='active'&&actor.activeMembershipCount===1&&actor.schoolUserCount===1&&(actor.role==='admin'||!adminOnly&&actor.role==='bursar');
}
export type FeeSchedule={id:string;schoolId:string;classId:string;sessionId:string;termId:string;version:number;status:'active'|'retired';lines:readonly {feeId:string;label:string;amountKobo:number}[]};
export type BillingEnrollment={id:string;studentId:string;schoolId:string;classId:string;sessionId:string;status:'active'|'inactive'};
export type FinanceInvoice={id:string;schoolId:string;studentId:string;enrollmentId:string;classId:string;sessionId:string;termId:string;scheduleId:string;scheduleVersion:number;issuedOn:string;version:number;currency:'NGN';lines:{feeId:string;label:string;amountKobo:number}[];totalKobo:number};
type Failure={ok:false;code:'invalid'|'forbidden'|'conflict'|'invalid_history'|'overpayment'|'duplicate_reference'};
export function prepareSchoolInvoice(actor:FinanceActor,schedule:FeeSchedule,enrollment:BillingEnrollment,invoiceId:string,today:string):{ok:true;invoice:FinanceInvoice}|Failure{
 if(!authorized(actor,schedule.schoolId))return{ok:false,code:'forbidden'};
 if(!id(invoiceId)||!day(today)||!version(schedule.version)||schedule.status!=='active'||![schedule.id,schedule.schoolId,schedule.classId,schedule.sessionId,schedule.termId,enrollment.id,enrollment.studentId].every(id)||enrollment.schoolId!==schedule.schoolId||enrollment.classId!==schedule.classId||enrollment.sessionId!==schedule.sessionId||enrollment.status!=='active'||!schedule.lines.length||schedule.lines.length>100||new Set(schedule.lines.map(l=>l.feeId)).size!==schedule.lines.length)return{ok:false,code:'invalid'};
 let total=0;const lines:FinanceInvoice['lines']=[];
 for(const line of schedule.lines){if(!id(line.feeId)||typeof line.label!=='string'||!line.label.trim()||line.label.trim().length>160||!money(line.amountKobo))return{ok:false,code:'invalid'};total+=line.amountKobo;if(!money(total))return{ok:false,code:'invalid'};lines.push({feeId:line.feeId,label:line.label.trim(),amountKobo:line.amountKobo});}
 if(!total)return{ok:false,code:'invalid'};
 return{ok:true,invoice:{id:invoiceId,schoolId:schedule.schoolId,studentId:enrollment.studentId,enrollmentId:enrollment.id,classId:schedule.classId,sessionId:schedule.sessionId,termId:schedule.termId,scheduleId:schedule.id,scheduleVersion:schedule.version,issuedOn:today,version:1,currency:'NGN',lines,totalKobo:total}};
}
export type FinancePayment={id:string;schoolId:string;invoiceId:string;amountKobo:number;method:'cash'|'bank_transfer'|'pos';reference:string|null;receivedOn:string;recordedBy:string};
export type FinanceReversal={id:string;schoolId:string;invoiceId:string;paymentId:string;amountKobo:number;reason:string;recordedBy:string};
export function invoiceBalance(invoice:FinanceInvoice,payments:readonly FinancePayment[],reversals:readonly FinanceReversal[]):{paidKobo:number;dueKobo:number;status:'unpaid'|'part_paid'|'paid'}|null{
 if(![invoice.id,invoice.schoolId,invoice.studentId,invoice.enrollmentId,invoice.classId,invoice.sessionId,invoice.termId,invoice.scheduleId].every(id)||!day(invoice.issuedOn)||!version(invoice.scheduleVersion)||!invoice.lines.length||invoice.lines.length>100||new Set(invoice.lines.map(l=>l.feeId)).size!==invoice.lines.length||invoice.lines.some(l=>!id(l.feeId)||typeof l.label!=='string'||!l.label.trim()||!money(l.amountKobo))||invoice.lines.reduce((sum,l)=>sum+l.amountKobo,0)!==invoice.totalKobo)return null;
 if(!money(invoice.totalKobo)||!invoice.totalKobo||invoice.currency!=='NGN'||!version(invoice.version)||new Set(payments.map(p=>p.id)).size!==payments.length||new Set(reversals.map(r=>r.id)).size!==reversals.length||new Set(reversals.map(r=>r.paymentId)).size!==reversals.length)return null;
 const references=new Set<string>();let paid=0;
 for(const payment of payments){
  if(!id(payment.id)||payment.schoolId!==invoice.schoolId||payment.invoiceId!==invoice.id||!money(payment.amountKobo)||!payment.amountKobo||!['cash','bank_transfer','pos'].includes(payment.method)||!day(payment.receivedOn)||payment.receivedOn<invoice.issuedOn||!id(payment.recordedBy)||payment.reference!==null&&(typeof payment.reference!=='string'||!payment.reference.trim()))return null;
  if(payment.method!=='cash'&&!payment.reference)return null;
  if(payment.reference){const key=payment.method+':'+payment.reference;if(references.has(key))return null;references.add(key);}
  paid+=payment.amountKobo;if(!Number.isSafeInteger(paid))return null;
 }
 for(const reversal of reversals){const payment=payments.find(p=>p.id===reversal.paymentId);if(!id(reversal.id)||reversal.schoolId!==invoice.schoolId||reversal.invoiceId!==invoice.id||!payment||reversal.amountKobo!==payment.amountKobo||!id(reversal.recordedBy)||!reversal.reason.trim())return null;paid-=reversal.amountKobo;}
 if(!money(paid)||paid>invoice.totalKobo)return null;
 return{paidKobo:paid,dueKobo:invoice.totalKobo-paid,status:paid===0?'unpaid':paid===invoice.totalKobo?'paid':'part_paid'};
}
export type FinanceCommand={action:'record_payment';invoiceId:string;expectedVersion:number;operationKey:string;amount:string;method:FinancePayment['method'];reference:string|null;receivedOn:string}|{action:'reverse_payment';invoiceId:string;expectedVersion:number;operationKey:string;paymentId:string;reason:string};
export function parseFinanceCommand(raw:unknown):FinanceCommand|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const r=raw as Record<string,unknown>;
 if(r.action!=='record_payment'&&r.action!=='reverse_payment')return null;
 const keys=['action','invoiceId','expectedVersion','operationKey',...(r.action==='record_payment'?['amount','method','reference','receivedOn']:['paymentId','reason'])];
 if(Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k))||!id(r.invoiceId)||!version(r.expectedVersion)||typeof r.operationKey!=='string'||!/^[A-Za-z0-9:_-]{8,120}$/.test(r.operationKey))return null;
 const common={invoiceId:r.invoiceId.toLowerCase(),expectedVersion:r.expectedVersion,operationKey:r.operationKey};
 if(r.action==='reverse_payment')return id(r.paymentId)&&typeof r.reason==='string'&&r.reason.trim().length>=3&&r.reason.trim().length<=2000?{action:r.action,...common,paymentId:r.paymentId.toLowerCase(),reason:r.reason.trim()}:null;
 const amount=parseNairaToKobo(r.amount);
 if(!amount||!['cash','bank_transfer','pos'].includes(String(r.method))||!day(r.receivedOn)||r.reference!==null&&(typeof r.reference!=='string'||!/^[A-Za-z0-9][A-Za-z0-9:/_.-]{0,99}$/.test(r.reference.trim()))||r.method!=='cash'&&r.reference===null)return null;
 return{action:r.action,...common,amount:formatKobo(amount),method:r.method as FinancePayment['method'],reference:typeof r.reference==='string'?r.reference.trim():null,receivedOn:r.receivedOn};
}
export type FinanceSuccess={ok:true;action:FinanceCommand['action'];invoiceId:string;version:number;eventId:string;receiptId:string|null};
export type FinanceOperationReceipt={schoolId:string;membershipId:string;operationKey:string;canonicalCommand:string;result:FinanceSuccess};
export type FinanceReceipt={id:string;schoolId:string;invoiceId:string;paymentId:string;currency:'NGN';amountKobo:number};
export type FinancePosting={kind:'apply';result:FinanceSuccess;payment:FinancePayment|null;reversal:FinanceReversal|null;receipt:FinanceReceipt|null;operationReceipt:FinanceOperationReceipt;audit:{schoolId:string;invoiceId:string;membershipId:string;action:FinanceCommand['action'];beforeVersion:number;afterVersion:number;reason:string|null}}|{kind:'replay';result:FinanceSuccess};
/** A write plan, not persistence. Future SQL must lock invoice/reference/operation
 * anchors, recheck complete authority and atomically apply every planned row.
 * References must be read across the entire school, including reversed history. */
export function planFinancePosting(actor:FinanceActor,invoice:FinanceInvoice,payments:readonly FinancePayment[],reversals:readonly FinanceReversal[],operations:readonly FinanceOperationReceipt[],references:readonly {schoolId:string;method:string;reference:string}[],raw:unknown,ids:{eventId:string;receiptId:string},today:string):{ok:true;posting:FinancePosting}|Failure{
 const command=parseFinanceCommand(raw);if(!command)return{ok:false,code:'invalid'};
 if(!authorized(actor,invoice.schoolId,command.action==='reverse_payment'))return{ok:false,code:'forbidden'};
 if(command.invoiceId!==invoice.id)return{ok:false,code:'forbidden'};
 const canonical=JSON.stringify(command),prior=operations.filter(o=>o.schoolId===actor.schoolId&&o.membershipId===actor.membershipId&&o.operationKey===command.operationKey);
 if(prior.length>1)return{ok:false,code:'invalid_history'};
 if(prior.length){const stored=prior[0]!;if(stored.canonicalCommand!==canonical)return{ok:false,code:'conflict'};if(Object.keys(stored.result).length!==6||stored.result.ok!==true||stored.result.action!==command.action||stored.result.invoiceId!==invoice.id||stored.result.version!==command.expectedVersion+1||!id(stored.result.eventId)||(command.action==='record_payment'?!id(stored.result.receiptId):stored.result.receiptId!==null))return{ok:false,code:'invalid_history'};return{ok:true,posting:{kind:'replay',result:{...stored.result}}};}
 if(!id(ids.eventId)||!id(ids.receiptId)||payments.some(p=>p.id===ids.eventId)||reversals.some(r=>r.id===ids.eventId)||!day(today)||command.expectedVersion!==invoice.version||invoice.version>=2147483646)return{ok:false,code:'conflict'};
 const balance=invoiceBalance(invoice,payments,reversals);if(!balance)return{ok:false,code:'invalid_history'};
 let payment:FinancePayment|null=null,reversal:FinanceReversal|null=null,receipt:FinanceReceipt|null=null;
 if(command.action==='record_payment'){
  const amount=parseNairaToKobo(command.amount)!;
  if(command.receivedOn>today||command.receivedOn<invoice.issuedOn)return{ok:false,code:'invalid'};
  if(amount>balance.dueKobo)return{ok:false,code:'overpayment'};
  if(command.reference&&(references.some(r=>r.schoolId===actor.schoolId&&r.method===command.method&&r.reference===command.reference)||payments.some(p=>p.method===command.method&&p.reference===command.reference)))return{ok:false,code:'duplicate_reference'};
  payment={id:ids.eventId,schoolId:actor.schoolId,invoiceId:invoice.id,amountKobo:amount,method:command.method,reference:command.reference,receivedOn:command.receivedOn,recordedBy:actor.membershipId};
  receipt={id:ids.receiptId,schoolId:actor.schoolId,invoiceId:invoice.id,paymentId:payment.id,currency:'NGN',amountKobo:amount};
 }else{
  const original=payments.find(p=>p.id===command.paymentId);if(!original||reversals.some(r=>r.paymentId===original.id))return{ok:false,code:'conflict'};
  reversal={id:ids.eventId,schoolId:actor.schoolId,invoiceId:invoice.id,paymentId:original.id,amountKobo:original.amountKobo,reason:command.reason,recordedBy:actor.membershipId};
 }
 const result:FinanceSuccess={ok:true,action:command.action,invoiceId:invoice.id,version:invoice.version+1,eventId:ids.eventId,receiptId:receipt?.id??null};
 return{ok:true,posting:{kind:'apply',result,payment,reversal,receipt,operationReceipt:{schoolId:actor.schoolId,membershipId:actor.membershipId,operationKey:command.operationKey,canonicalCommand:canonical,result:{...result}},audit:{schoolId:actor.schoolId,invoiceId:invoice.id,membershipId:actor.membershipId,action:command.action,beforeVersion:invoice.version,afterVersion:result.version,reason:command.action==='reverse_payment'?command.reason:null}}};
}
