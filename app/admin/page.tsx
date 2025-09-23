export const runtime = 'nodejs';

export default function Admin() {
  return (
    <main
      style={{
        padding: 20,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <h1>DeadlineNoon — Admin</h1>
      <p>Protected with Basic Auth. Vercel Web Analytics is active via &lt;Analytics /&gt;.</p>
      <ul>
        <li>Check Vercel → Project → Analytics for full charts.</li>
        <li>We can add on-site deltas (DoD/WoW/MoM/YoY) here later.</li>
      </ul>
    </main>
  );
}
