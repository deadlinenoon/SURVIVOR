"use client";
import { useEffect, useState } from "react";
import { ELIMINATED } from "@/lib/contest";

type Pick = { week:number; team:string; result:"W"|"L"|"P" };
type Entry = { name:string; picks: Pick[] };

export default function Density(){
  const [rows,setRows]=useState<Entry[]>([]);
  useEffect(()=>{(async()=>{
    try{
      const r=await fetch("/density.json",{cache:"no-store"}); if(!r.ok) return;
      const data=await r.json();
      data.forEach((e:Entry)=> e.picks.forEach(p=>{ if (p.week<=3) p.result="W"; }));
      setRows(data);
    }catch{}
  })()},[]);
  if(!rows.length) return null;

  const Cell=({p}:{p?:Pick})=>{
    if (!p) return <>—</>;
    return <span className="badge badge-win">W · {p.team}</span>;
  };

  return (
    <div className="tile">
      <div className="font-semibold mb-2">Density (Weeks 1–3 locked as W)</div>
      <table className="w-full text-sm">
        <thead><tr><th className="text-left">Entry</th><th>W1</th><th>W2</th><th>W3</th></tr></thead>
        <tbody>
          {rows.map((e,i)=>{
            const cls = ELIMINATED.has(e.name) ? "elim" : "";
            const w=(k:number)=> e.picks.find(p=>p.week===k);
            return (
              <tr key={i} className={cls}>
                <td>{e.name}</td>
                <td className="text-center"><Cell p={w(1)}/></td>
                <td className="text-center"><Cell p={w(2)}/></td>
                <td className="text-center"><Cell p={w(3)}/></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
