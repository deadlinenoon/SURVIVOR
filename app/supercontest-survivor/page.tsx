import "../improved.css";
import { usd0, scsImplied } from "@/lib/contest";
import SCSplit from "@/components/SCSplit";
import LegacyEmbed from "@/components/LegacyEmbed";

export const metadata = { title: "SuperContest Survivor" };

export default function SuperContestSurvivor(){
  const implied = scsImplied();
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="tile">
        <div className="font-semibold">SuperContest Survivor (Westgate)</div>
        <div className="small">Siloed from Circa; entry: <strong>Doigetashirtwiththat</strong>.</div>
        <div className="mt-2">Implied per entry: <strong>{usd0(implied)}</strong></div>
        <div className="small">W1 Jaguars, W2 Lions, W3 Chiefs — advanced to Week 4.</div>
      </div>
      <section className="mt-6"><SCSplit /></section>

      <LegacyEmbed
        src="/scs.html"
        title="Full SuperContest Survivor Dashboard (Legacy Tools)"
        minHeight={2200}
      />
    </main>
  );
}
