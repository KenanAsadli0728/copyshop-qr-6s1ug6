import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#5B4FE9",
          borderRadius: 32,
        }}
      >
        <div style={{ fontSize: 100 }}>🖨️</div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
