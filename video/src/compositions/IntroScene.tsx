import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

export const IntroScene: React.FC<{
  title?: string;
  subtitle?: string;
  color?: string;
}> = ({ title = "DerLg", subtitle = "Book Cambodia trips by chatting with AI", color = "#0f766e" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title: spring bounce in
  const titleSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const titleScale = interpolate(titleSpring, [0, 1], [0.3, 1]);
  const titleOpacity = interpolate(titleSpring, [0, 0.5], [0, 1]);

  // Title letter stagger: each letter(s) pops in after the bounce settles
  const letters = title.split("");
  const titleStaggerBase = 0.6 * fps;

  // Subtitle: fade up with easing
  const subOpacity = interpolate(
    frame,
    [1.2 * fps, 1.8 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
  );
  const subY = interpolate(
    frame,
    [1.2 * fps, 1.8 * fps],
    [20, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
  );

  // Decorative ring: expanding outward
  const ringProgress = interpolate(frame, [0.3 * fps, 2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const ringScale = interpolate(ringProgress, [0, 1], [0.4, 2.5]);
  const ringOpacity = interpolate(ringProgress, [0, 0.6, 1], [0.5, 0.2, 0]);

  // Floating particles (decorative dots)
  const particles = [
    { x: 180, y: 200, size: 6, delay: 0 },
    { x: 900, y: 400, size: 8, delay: 0.3 },
    { x: 150, y: 1400, size: 5, delay: 0.6 },
    { x: 850, y: 1600, size: 7, delay: 0.2 },
    { x: 500, y: 300, size: 4, delay: 0.5 },
    { x: 700, y: 1700, size: 6, delay: 0.1 },
  ];

  // Breathing glow behind title
  const glowPulse = interpolate(frame % (1.5 * fps), [0, fps], [0.15, 0.35], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `radial-gradient(ellipse at 50% 40%, ${color} 0%, #0a2e2a 60%, #051513 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Floating ambient particles */}
      {particles.map((p, i) => {
        const pFrame = frame - p.delay * fps;
        const floatY = interpolate(pFrame % (3 * fps), [0, 3 * fps], [0, -30], {
          extrapolateRight: "clamp",
        });
        const floatOpacity = interpolate(pFrame % (3 * fps), [0, 0.5 * fps, 2.5 * fps, 3 * fps], [0, 0.6, 0.6, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y + floatY,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.5)",
              opacity: floatOpacity,
            }}
          />
        );
      })}

      {/* Expanding ring */}
      <div
        style={{
          position: "absolute",
          width: 200,
          height: 200,
          borderRadius: "50%",
          border: `2px solid rgba(255,255,255,${0.15 * (1 - ringProgress)})`,
          transform: `scale(${ringScale})`,
          opacity: ringOpacity,
        }}
      />

      {/* Glow behind title */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(20,184,166,${glowPulse}) 0%, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />

      {/* Title with letter stagger */}
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          color: "white",
          letterSpacing: "-0.02em",
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          marginBottom: 24,
          display: "flex",
        }}
      >
        {letters.map((letter, i) => {
          const letterFrame = frame - (titleStaggerBase + i * 4);
          const letterScale = spring({ frame: letterFrame, fps, config: { damping: 14, stiffness: 150 } });
          const letterOp = interpolate(letterScale, [0, 0.5], [0, 1]);
          const letterY = interpolate(letterScale, [0, 1], [15, 0]);
          return (
            <span
              key={i}
              style={{
                opacity: letterOp,
                transform: `translateY(${letterY}px)`,
                display: "inline-block",
              }}
            >
              {letter === " " ? "\u00A0" : letter}
            </span>
          );
        })}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 26,
          color: "rgba(255,255,255,0.85)",
          textAlign: "center",
          maxWidth: 650,
          lineHeight: 1.5,
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
        }}
      >
        {subtitle}
      </div>

      {/* Compass icon decoration */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          fontSize: 28,
          opacity: interpolate(frame, [2 * fps, 2.5 * fps], [0, 0.4], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `rotate(${interpolate(frame, [2 * fps, 5 * fps], [0, 360], { extrapolateRight: "clamp" })}deg)`,
        }}
      >
        🧭
      </div>
    </div>
  );
};
