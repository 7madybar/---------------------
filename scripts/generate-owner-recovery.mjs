import { randomBytes,randomUUID,createHash } from 'node:crypto';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normalized=Array.from(randomBytes(20),x=>alphabet[x&31]).join('');
const code='VG-'+normalized.match(/.{5}/g).join('-');
// Private operator output: never redirect this JSON into the source tree.
console.log(JSON.stringify({code,id:randomUUID(),proof:createHash('sha256').update('owner-recovery:'+normalized).digest('hex'),expiresAt:String(Math.floor(Date.now()/1000)+1800)}));
