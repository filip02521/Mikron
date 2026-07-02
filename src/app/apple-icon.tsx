import { ImageResponse } from "next/og";
import { brandAppIconDataUri } from "@/lib/ui/brand-app-icon-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — ten sam znak co AppBrandMark (gradient, tarcza, OT). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        {/* next/og ImageResponse wymaga <img> z data URI */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brandAppIconDataUri()} width={180} height={180} alt="" />
      </div>
    ),
    { ...size }
  );
}
