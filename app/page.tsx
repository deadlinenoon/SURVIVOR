'use client';

import { useEffect, useMemo, useState } from 'react';

const contests = {
  circa: {
    name: 'Circa Survivor',
    initialEntries: 18718,
    liveEntries: 16908,
    buyIn: 1000,
    prizePool: 18718000,
    iframeSrc: '/circa.html',
  },
  scs: {
    name: 'SuperContest Survivor',
    initialEntries: 111,
    liveEntries: 81,
    buyIn: 5000,
    prizePool: 111 * 5000,
    iframeSrc: '/scs.html',
  },
} as const;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function Home() {
  const [active, setActive] = useState<'circa' | 'scs'>('circa');
  const [timestamp, setTimestamp] = useState<string>(() => new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));

  useEffect(() => {
    const id = window.setInterval(() => {
      setTimestamp(new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const summary = useMemo(() => {
    return (Object.entries(contests) as Array<[keyof typeof contests, (typeof contests)['circa']]>)
      .map(([key, meta]) => ({
        key,
        name: meta.name,
        implied: usd.format(Math.round(meta.prizePool / Math.max(meta.liveEntries, 1))),
        note: `${meta.liveEntries.toLocaleString()} alive / ${meta.initialEntries.toLocaleString()} start • buy-in ${usd.format(meta.buyIn)}`,
      }));
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <header style={styles.header}>
          <div>
            <div style={styles.badge}>Survivor Control Hub</div>
            <div style={styles.brand}>Deadline<span style={styles.accent}>Noon</span> — Survivor</div>
          </div>
          <div style={styles.badge}>Updated: {timestamp}</div>
        </header>

        <section style={styles.summaryGrid}>
          {summary.map(card => (
            <div style={styles.summaryCard} key={card.key}>
              <div style={styles.summaryLabel}>{card.name}</div>
              <div style={styles.summaryValue}>{card.implied}</div>
              <div style={styles.summaryNote}>{card.note}</div>
            </div>
          ))}
        </section>

        <div role="tablist" aria-label="Contest selector" style={styles.tabs}>
          {(Object.keys(contests) as Array<'circa' | 'scs'>).map(key => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active === key}
              aria-controls={`panel-${key}`}
              style={{ ...styles.tabButton, ...(active === key ? styles.tabButtonActive : undefined) }}
              onClick={() => setActive(key)}
            >
              {contests[key].name}
            </button>
          ))}
        </div>
        <div style={styles.hint}>Use the toggle above to jump between contest dashboards. All widgets stay interactive within each view.</div>

        <div style={styles.iframes}>
          {(Object.entries(contests) as Array<[typeof active, (typeof contests)['circa']]>)
            .map(([key, meta]) => (
              <iframe
                key={key}
                id={`panel-${key}`}
                title={`${meta.name} Dashboard`}
                src={meta.iframeSrc}
                style={{ ...styles.frame, display: active === key ? 'block' : 'none' }}
              />
            ))}
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    margin: 0,
    padding: 0,
    minHeight: '100vh',
    background: '#0f1115',
    color: '#e7e9ee',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
  wrap: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '24px 20px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  badge: {
    border: '1px solid #262a3b',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    color: '#9aa3b2',
  },
  brand: {
    fontSize: 28,
    fontWeight: 800,
  },
  accent: {
    color: '#7c5cff',
  },
  summaryGrid: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  },
  summaryCard: {
    border: '1px solid #262a3b',
    borderRadius: 14,
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  summaryLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
    color: '#9aa3b2',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 700,
  },
  summaryNote: {
    fontSize: 12,
    color: '#9aa3b2',
  },
  tabs: {
    display: 'inline-flex',
    border: '1px solid #262a3b',
    borderRadius: 999,
    padding: 4,
    background: 'rgba(255,255,255,0.02)',
    width: 'fit-content',
  },
  tabButton: {
    appearance: 'none',
    border: 0,
    background: 'transparent',
    color: '#9aa3b2',
    padding: '6px 16px',
    borderRadius: 999,
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabButtonActive: {
    background: '#7c5cff',
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#9aa3b2',
  },
  iframes: {
    position: 'relative',
    width: '100%',
  },
  frame: {
    width: '100%',
    border: '1px solid #262a3b',
    borderRadius: 16,
    background: '#0f1115',
    minHeight: 1600,
    boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
  },
};
