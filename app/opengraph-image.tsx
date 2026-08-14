import { ImageResponse } from "next/og";

export const alt = "UniPlug — software keys and digital services";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0b1d42",
        color: "white",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: "72px",
        width: "100%"
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 30, width: "100%" }}>
        <div style={{ alignItems: "center", display: "flex", gap: 20 }}>
          <div style={{ alignItems: "center", background: "#c8f05c", borderRadius: 999, color: "#0b1d42", display: "flex", fontSize: 38, fontWeight: 900, height: 76, justifyContent: "center", width: 76 }}>u</div>
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-2px" }}>uniplug</div>
        </div>
        <div style={{ display: "flex", fontSize: 78, fontWeight: 900, letterSpacing: "-4px", lineHeight: 1.02, maxWidth: 920 }}>Software keys, simply delivered.</div>
        <div style={{ color: "#c4cee0", display: "flex", fontSize: 30 }}>Clear pricing · Secure checkout · Activation support</div>
      </div>
    </div>,
    size
  );
}
