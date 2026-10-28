import { ImageResponse } from "next/og";

export const alt = "HD Creative — Connect property ads with buyer conversations";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f1115",
          color: "#eef0f5",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            H
          </div>
          <div style={{ fontSize: 30, fontWeight: 600 }}>HD Creative</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.12, maxWidth: 900 }}>
            See which property ads actually bring you buyers.
          </div>
          <div style={{ marginTop: 22, fontSize: 26, color: "#a3aabb", maxWidth: 880, lineHeight: 1.4 }}>
            Meta Ads spend connected with WhatsApp conversations: CPQL, Buyer Score, and sales response time.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {["CPQL", "Buyer Score", "Response SLA", "Attribution"].map((chip) => (
            <div
              key={chip}
              style={{
                border: "1px solid #343a47",
                borderRadius: 999,
                padding: "8px 18px",
                fontSize: 20,
                color: "#c6cbda",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
