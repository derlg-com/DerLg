import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

export const ProblemScene: React.FC<{ stressText?: string; color?: string }> = ({
  stressText = "Too many tabs. Too many choices.",
  color = "#64748b",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Window card: spring entrance
  const windowSpring = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const windowOpacity = interpolate(windowSpring, [0, 0.4], [0, 1]);
  const windowY = interpolate(windowSpring, [0, 1], [60, 0]);

  // Window subtle breathing
  const breathY = interpolate(frame % (3 * fps), [0, 1.5 * fps, 3 * fps], [0, -4, 0], {
    extrapolateRight: "clamp",
  });

  // Subtitle text
  const textOpacity = interpolate(
    frame,
    [0.8 * fps, 1.2 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
  );

  // Stress text: bouncy scale in
  const stressSpring = spring({ frame, fps, config: { damping: 8, stiffness: 80 } });
  const stressScale = interpolate(stressSpring, [0, 1], [0.7, 1]);
  const stressOpacity = interpolate(frame, [1.8 * fps, 2.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Stress text shake
  const shakeX = Math.sin(frame * 0.5) * interpolate(frame, [2.5 * fps, 3.5 * fps], [0, 3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Window bar typing animation (fills like typing)
  const bars = [1, 2, 3, 4];
  const barDelays = [0, 0.15, 0.3, 0.45];

  // Floating confetti-like frustration dots
  const frustDots = [
    { x: -60, y: -30, dx: 0.3, dy: -0.5 },
    { x: 70, y: -50, dx: -0.4, dy: -0.3 },
    { x: -80, y: 60, dx: 0.5, dy: 0.2 },
    { x: 50, y: 80, dx: -0.2, dy: -0.6 },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
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
      {/* Frustration sparkles around window */}
      {frustDots.map((d, i) => {
        const dotX = d.x + Math.sin(frame * d.dx) * 15;
        const dotY = d.y + Math.cos(frame * d.dy) * 12;
        const dotOp = interpolate(frame % (2 * fps), [0, fps, 2 * fps], [0, 0.5, 0], {
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(50% + ${dotX}px)`,
              top: `calc(50% + ${dotY}px)`,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#94a3b8",
              opacity: dotOp,
            }}
          />
        );
      })}

      {/* Window card */}
      <div
        style={{
          opacity: windowOpacity,
          transform: `translateY(${windowY + breathY}px)`,
          background: "white",
          borderRadius: 24,
          padding: "40px 48px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
          marginBottom: 40,
          width: 520,
          maxWidth: "90vw",
        }}
      >
        {/* Window chrome */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px rgba(239,68,68,0.3)" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 8px rgba(245,158,11,0.3)" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.3)" }} />
        </div>

        {/* Loading bars with typing fill effect */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {bars.map((bar, i) => {
            const fillProgress = interpolate(
              frame,
              [1 * fps + barDelays[i] * fps, 1.5 * fps + barDelays[i] * fps],
              [20, 40 + bar * 10],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
            );
            const barOpacity = interpolate(
              frame,
              [1 * fps + barDelays[i] * fps, 1.2 * fps + barDelays[i] * fps],
              [0, 0.5 + i * 0.12],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    height: 14,
                    width: `${fillProgress}%`,
                    borderRadius: 7,
                    background: `linear-gradient(90deg, ${color}${Math.floor((0.2 + i * 0.1) * 255).toString(16).padStart(2, '0')} 0%, ${color} 100%)`,
                    opacity: barOpacity,
                  }}
                />
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "3px",
                    background: "#cbd5e1",
                    opacity: barOpacity,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 20,
          color,
          fontWeight: 600,
          opacity: textOpacity,
          textAlign: "center",
        }}
      >
        Planning a trip shouldn't feel like this.
      </div>

      {/* Stress headline */}
      <div
        style={{
          fontSize: 38,
          color: "#1e293b",
          fontWeight: 800,
          marginTop: 20,
          opacity: stressOpacity,
          textAlign: "center",
          transform: `translateX(${shakeX}px) scale(${stressScale})`,
          lineHeight: 1.3,
          letterSpacing: "-0.01em",
        }}
      >
        {stressText}
      </div>

      {/* Exclamation sparkle */}
      <div
        style={{
          position: "absolute",
          top: "52%",
          right: "18%",
          fontSize: 32,
          opacity: interpolate(frame % (1.5 * fps), [0, fps, 1.5 * fps], [0, 0.8, 0], {
            extrapolateRight: "clamp",
          }),
          transform: `scale(${interpolate(frame % (1.5 * fps), [0, fps], [0.5, 1.2], { extrapolateRight: "clamp" })})`,
        }}
      >
        😫
      </div>
    </div>
  );
};
