export const ELIMINATED = new Set<string>([
  "SLYBIZ", // auto-grey everywhere
  // add more names as they bust
]);

export const usd0 = (n:number)=> new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
export const implied = (pool:number, live:number)=> live>0 ? pool/live : 0;

export function circaImplied(){
  return implied(Number(process.env.CIRCA_TOTAL_PRIZE_POOL??0), Number(process.env.CIRCA_LIVE_ENTRIES??0));
}
export function scsImplied(){
  return implied(Number(process.env.SCS_TOTAL_PRIZE_POOL??0), Number(process.env.SCS_LIVE_ENTRIES??0));
}
