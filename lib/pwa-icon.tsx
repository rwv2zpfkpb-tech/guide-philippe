// Shared "GP" wordmark for favicon/apple-touch-icon/manifest icons — mirrors
// the burgundy/gold hero watermark on the landing page (app/page.tsx). Used
// by app/icon.tsx, app/apple-icon.tsx and app/icons/[size]/route.tsx via
// next/og's ImageResponse, which renders with Satori and can't read CSS
// custom properties — hex values below match the ones already used for the
// same reason in lib/auth-emails.ts's email template palette.
export function gpMarkElement(size: number) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#5c2a28",
        color: "#b08a4e",
        fontFamily: "Georgia, serif",
        fontWeight: 700,
        fontSize: Math.round(size * 0.42),
      }}
    >
      GP
    </div>
  );
}
