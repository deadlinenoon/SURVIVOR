export default function Home() {
  return (
    <main
      style={{
        margin: 0,
        padding: 0,
        minHeight: "100vh",
        background: "#0f1115",
      }}
    >
      <iframe
        src="/legacy.html"
        title="DeadlineNoon Survivor Dashboard"
        style={{
          border: 0,
          width: "100%",
          minHeight: "100vh",
          display: "block",
        }}
      />
    </main>
  );
}
