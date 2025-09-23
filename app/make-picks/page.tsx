"use client";
import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  commence: string;
  homeTeam: string;
  awayTeam: string;
  moneyline: Record<string, number | undefined>;
  spread: {
    fav?: { name: string; point: number; price?: number };
    dog?: { name: string; point: number; price?: number };
  };
};

const fmtKick = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

const logo = (team: string) => `/logos/nfl/${team}.svg`;

function Team({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo(name)} alt={`${name} logo`} className="h-6 w-6"
        onError={(e)=>{ (e.target as HTMLImageElement).style.display='none'; }} />
      <span className="font-medium">{name}</span>
    </div>
  );
}

export default function MakePicks() {
  const [user, setUser] = useState("");   // front-end gate only (real auth later)
  const [pass, setPass] = useState("");
  const [ok, setOk] = useState(false);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ok) return;
    (async ()=>{
      setLoading(true); setErr(null);
      try {
        const r = await fetch("/api/odds", { cache: "no-store" });
        if (!r.ok) throw new Error(`Fetch failed (${r.status})`);
        const data = await r.json();
        setRows(data.rows || []);
      } catch(e:any) { setErr(String(e?.message||e)); }
      finally { setLoading(false); }
    })();
  }, [ok]);

  const onSubmit = (e: React.FormEvent)=>{ e.preventDefault(); if(user && pass) setOk(true); };
  const games = useMemo(()=>[...rows].sort((a,b)=>+new Date(a.commence)-+new Date(b.commence)),[rows]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold">Make Picks</h1>
      <p className="text-sm text-gray-600">Login required. For now, entering any credentials unlocks odds (auth to be wired later).</p>

      {!ok ? (
        <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                 placeholder="Username" value={user} onChange={e=>setUser(e.target.value)} />
          <input className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                 placeholder="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} />
          <button className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700" type="submit">Sign In</button>
        </form>
      ) : (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">This Week’s Games</h2>
            <button className="text-sm text-blue-600 hover:underline" onClick={()=>{ setOk(false); setUser(""); setPass(""); }}>Sign out</button>
          </div>

          {loading && <div className="text-gray-500">Loading odds…</div>}
          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">Error: {err}</div>}

          <ul className="grid grid-cols-1 gap-4">
            {games.map(g=>{
              const mlH = g.moneyline[g.homeTeam];
              const mlA = g.moneyline[g.awayTeam];
              const { fav, dog } = g.spread;
              return (
                <li key={g.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <Team name={g.awayTeam} /><span className="text-gray-500">@</span><Team name={g.homeTeam} />
                    </div>
                    <div className="text-sm text-gray-500">{fmtKick(g.commence)}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="text-xs uppercase text-gray-500">Moneyline (DraftKings)</div>
                      <div className="mt-1 flex justify-between"><span>{g.awayTeam}</span><span className="font-semibold">{mlA ?? "—"}</span></div>
                      <div className="mt-1 flex justify-between"><span>{g.homeTeam}</span><span className="font-semibold">{mlH ?? "—"}</span></div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="text-xs uppercase text-gray-500">Spread (DraftKings)</div>
                      <div className="mt-1 flex justify-between">
                        <span>{fav?.name ?? "Fav"}</span>
                        <span className="font-semibold">{fav ? `${fav.point>0?"+":""}${fav.point} (${fav.price ?? "—"})` : "—"}</span>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <span>{dog?.name ?? "Dog"}</span>
                        <span className="font-semibold">{dog ? `${dog.point>0?"+":""}${dog.point} (${dog.price ?? "—"})` : "—"}</span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="text-xs uppercase text-gray-500">Your Pick</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">{g.awayTeam}</button>
                        <button className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">{g.homeTeam}</button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">(Saving picks wires up after real auth.)</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
