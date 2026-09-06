import { ImageResponse } from "next/og";

export const alt = "StudySourced AI — AI study tools, sourced from your course.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ background: "#F7F7F5", color: "#264653", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", padding: "72px", width: "100%" }}>
        <div style={{ alignItems: "center", display: "flex", fontSize: 34, fontWeight: 700, gap: "16px" }}>
          <span>StudySourced</span>
          <span style={{ background: "#2A9D8F", borderRadius: "8px", color: "white", fontSize: 18, letterSpacing: "2px", padding: "8px 12px" }}>AI</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "900px" }}>
          <div style={{ color: "#2A9D8F", fontSize: 20, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase" }}>AI grounded in your course</div>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-4px", lineHeight: 1.02, marginTop: "24px" }}>Teach and study from the source.</div>
        </div>
        <div style={{ borderTop: "2px solid #D9D9D4", display: "flex", justifyContent: "space-between", paddingTop: "24px" }}>
          <span style={{ color: "#565650", fontSize: 22 }}>Editable assessments</span>
          <span style={{ color: "#565650", fontSize: 22 }}>Citation-backed guidance</span>
          <span style={{ color: "#565650", fontSize: 22 }}>Private sources</span>
        </div>
      </div>
    ),
    size,
  );
}
