const KEY='gestion-agence-offline-queue';
export const newId=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
export function readQueue(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}}
export function writeQueue(ops){if(ops.length)localStorage.setItem(KEY,JSON.stringify(ops));else localStorage.removeItem(KEY)}
export function enqueue(op){writeQueue([...readQueue(),op])}
export function clearQueue(){localStorage.removeItem(KEY)}

/** Applique une opération de la file ; `status===0` signale une panne réseau (à réessayer). */
export async function applyOp(client,op){try{const q=op.kind==='delete'?client.from(op.table).delete().eq('id',op.row.id):client.from(op.table).upsert(op.row);const r=await q;return {error:r.error?.message||null,network:Boolean(r.error)&&r.status===0}}catch(e){return {error:e.message,network:true}}}

/** Rejoue la file hors ligne. Les opérations en panne réseau sont conservées ; celles refusées par la base sont retirées et comptées. */
export async function flushQueue(client){const ops=readQueue();if(!ops.length)return {sent:0,kept:0,rejected:[]};const kept=[],rejected=[];let sent=0;for(let i=0;i<ops.length;i++){const r=await applyOp(client,ops[i]);if(!r.error)sent++;else if(r.network){kept.push(...ops.slice(i));break}else rejected.push(r.error)}writeQueue(kept);return {sent,kept:kept.length,rejected}}
