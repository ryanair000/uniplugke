/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

export const alt = "UniPlug — software, gaming and everyday tech";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoMark = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%234D87FF' d='M9 22h13v20a10 10 0 0 0 20 0V22h13v20a23 23 0 0 1-46 0V22Z'/%3E%3Crect width='10' height='18' x='14' y='3' rx='2' fill='%234D87FF'/%3E%3Crect width='10' height='18' x='40' y='3' rx='2' fill='%234D87FF'/%3E%3Crect width='16' height='7' x='24' y='22' rx='2' fill='%23B8F500'/%3E%3C/svg%3E";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#081B3F",
        color: "white",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: "68px 76px",
        width: "100%"
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 30, width: "100%" }}>
        <div style={{ alignItems: "center", display: "flex", gap: 22 }}>
          <img alt="" height={82} src={logoMark} width={82} />
          <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: "0" }}>uniplug</div>
        </div>
        <div style={{ display: "flex", fontSize: 70, fontWeight: 900, letterSpacing: "0", lineHeight: 1.04, maxWidth: 990 }}>Software, devices and gaming gear.</div>
        <div style={{ color: "#C5D0E3", display: "flex", fontSize: 28 }}>Shop everyday tech with delivery across Kenya.</div>
        <div style={{ background: "#B8F500", display: "flex", height: 10, marginTop: 8, width: 210 }} />
      </div>
    </div>,
    size
  );
}
