interface Props { last5: string; }

export default function Last5Badge({ last5 }: Props) {
  const games = (last5 || "").split("").slice(0, 5);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {games.map((g, i) => (
        <span key={i} style={{
          width: 18, height: 18, borderRadius: 4, fontSize: 9, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: g === "W" ? "#ecfdf5" : g === "L" ? "#fff5f5" : "#f1f5f9",
          color:      g === "W" ? "#0ab07a" : g === "L" ? "#e53e3e" : "#64748b",
        }}>
          {g === "W" ? "승" : g === "L" ? "패" : "무"}
        </span>
      ))}
    </div>
  );
}
