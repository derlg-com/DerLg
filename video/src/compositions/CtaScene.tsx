import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

interface CtaProps {
  ctaText?: string;
  color?: string;
}

export const CtaScene: React.FC<CtaProps> = ({
  ctaText = "Install DerLg PWA — your Cambodia trip starts with a chat",
  color = "#0f766e",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo: bouncy spring
  const logoSpring = spring({ frame, fps, config: { damping: 8, stiffness: 80 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.4, 1]);

  // Underline bar that grows
  const barProgress = interpolate(frame, [0.8 * fps, 1.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // CTA text: slide up
  const ctaOp = interpolate(frame, [1.2 * fps, 2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const ctaY = interpolate(frame, [1.2 * fps, 2 * fps], [25, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // QR code area
  const qrOp = interpolate(frame, [2.2 * fps, 2.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const qrY = interpolate(frame, [2.2 * fps, 2.8 * fps], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // QR code finder dots (animated corners)
  const finderBounce = (offset: number) =>
    interpolate((frame - 2.5 * fps - offset) % (1.5 * fps), [0, 0.75 * fps, 1.5 * fps], [1, 1.1, 1], {
      extrapolateRight: "clamp",
    });

  // Arrow bob
  const arrowY = interpolate(frame % (1.8 * fps), [0, 0.9 * fps, 1.8 * fps], [0, -10, 0], {
    extrapolateRight: "clamp",
  });

  // Floating sparkles
  const sparkles = [
    { x: -100, y: -60, size: 4, delay: 0 },
    { x: 90, y: -80, size: 6, delay: 0.3 },
    { x: -80, y: 70, size: 3, delay: 0.5 },
    { x: 110, y: 50, size: 5, delay: 0.2 },
    { x: 0, y: -120, size: 4, delay: 0.4 },
    { x: -60, y: 140, size: 3, delay: 0.15 },
  ];

  // Background gradient shift
  const bgShift = interpolate(frame, [0, fps, 2 * fps, 3 * fps], [0, 0.02, -0.01, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(${170 + bgShift * 30}deg, ${color} 0%, #0a5c52 50%, #063d37 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 60,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Sparkle particles */}
      {sparkles.map((s, i) => {
        const sFrame = frame - s.delay * fps;
        const floatY = interpolate(sFrame % (3 * fps), [0, 1.5 * fps, 3 * fps], [0, -25, 0], {
          extrapolateRight: "clamp",
        });
        const floatX = Math.sin(sFrame * 0.05 + i) * 10;
        const sOp = interpolate(sFrame % (2.5 * fps), [0, 0.4 * fps, 2 * fps, 2.5 * fps], [0, 0.7, 0.7, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(50% + ${s.x + floatX}px)`,
              top: `calc(50% + ${s.y + floatY}px)`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              background: "white",
              opacity: sOp,
              boxShadow: `0 0 ${s.size * 3}px rgba(255,255,255,0.4)`,
            }}
          />
        );
      })}

      {/* Logo */}
      <div
        style={{
          fontSize: 80,
          fontWeight: 900,
          color: "white",
          letterSpacing: "-0.03em",
          transform: `scale(${logoScale})`,
          marginBottom: 8,
          position: "relative",
          zIndex: 2,
          textShadow: `0 0 60px rgba(255,255,255,0.2)`,
        }}
      >
        DerLg
      </div>

      {/* Animated underline */}
      <div
        style={{
          width: interpolate(barProgress, [0, 1], [0, 120]),
          height: 3,
          borderRadius: 2,
          background: "rgba(255,255,255,0.5)",
          marginBottom: 28,
          position: "relative",
          zIndex: 2,
        }}
      />

      {/* CTA text */}
      <div
        style={{
          fontSize: 30,
          fontWeight: 600,
          color: "rgba(255,255,255,0.95)",
          textAlign: "center",
          maxWidth: 720,
          lineHeight: 1.4,
          opacity: ctaOp,
          transform: `translateY(${ctaY}px)`,
          marginBottom: 44,
          position: "relative",
          zIndex: 2,
          letterSpacing: "-0.005em",
        }}
      >
        {ctaText}
      </div>

      {/* QR + arrow */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          opacity: qrOp,
          transform: `translateY(${qrY}px)`,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: 150,
            height: 150,
            background: "white",
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 60px rgba(255,255,255,0.12), 0 20px 50px rgba(0,0,0,0.25)`,
            position: "relative",
          }}
        >
          {/* Simulated QR pattern */}
          <div
            style={{
              width: 110,
              height: 110,
              background: `repeating-conic-gradient(#1e293b 0% 25%, white 0% 50%) 50% / 14px 14px`,
              borderRadius: 6,
            }}
          />

          {/* Finder corner dots */}
          {[
            { top: 14, left: 14 },
            { top: 14, right: 14 },
            { bottom: 14, left: 14 },
          ].map((pos, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                ...pos,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: color,
                transform: `scale(${finderBounce(i * 3)})`,
                transformOrigin: "center",
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.65)",
            fontWeight: 500,
            transform: `translateY(${arrowY}px)`,
            letterSpacing: "0.02em",
          }}
        >
          Scan to install PWA →
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          fontSize: 12,
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.05em",
          position: "relative",
          zIndex: 2,
        }}
      >
        derlg.com · Made for travelers
      </div>
    </div>
  );
};
