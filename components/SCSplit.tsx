"use client";
import { usd0, scsImplied } from "@/lib/contest";

const PRIZE = Number(process.env.SCS_TOTAL_PRIZE_POOL ?? 555000);
const SPLIT = [
  { name:"Tim", pct:0.10 }, { name:"Kevin LA", pct:0.20 },
  { name:"Doug", pct:0.10 },{ name:"Tom", pct:0.10 },
  { name:"David", pct:0.10 },{ name:"George", pct:0.40 },
];

export default function SCSplit(){
  const implied = scsImplied();
  return (
    <div className="tile">
      <div className="font-semibold mb-2">Hypothetical Win Split — {usd0(PRIZE)}</div>
      <table className="w-full text-sm">
        <thead><tr><th className="text-left">Partner</th><th>Share</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{SPLIT.map((r,i)=>(<tr key={i}><td>{r.name}</td><td>{Math.round(r.pct*100)}%</td><td className="text-right">{usd0(Math.round(PRIZE*r.pct))}</td></tr>))}</tbody>
      </table>
      <div className="small mt-2">SCS implied per entry: <strong>{usd0(implied)}</strong></div>
    </div>
  );
}
