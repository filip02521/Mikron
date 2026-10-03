import { ImageResponse } from "next/og";
import { brandAppIconDataUri } from "@/lib/ui/brand-app-icon-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — ten sam znak co AppBrandMark; pełny kwadrat (maskę nakłada iOS). */
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
        <img src={brandAppIconDataUri({ fullBleed: true })} width={180} height={180} alt="" />
      </div>
    ),
    { ...size }
  );
}
