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
          borderRadius: 84,
        }}
      >
        <div style={{ fontSize: 260 }}>🖨️</div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
