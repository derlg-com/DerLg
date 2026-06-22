import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

export const SafetyScene: React.FC<{ color?: string }> = ({ color = "#dc2626" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Shield: spring entrance
  const shieldSpring = spring({ frame, fps, config: { damping: 10, stiffness: 80 } });
  const shieldScale = interpolate(shieldSpring, [0, 1], [0.3, 1]);

  // Breathing pulse (continuous after entrance)
  const breathe = interpolate(frame % (2 * fps), [0, fps, 2 * fps], [1, 1.08, 1], {
    extrapolateRight: "clamp",
  });

  // Outer radar rings
  const ringCount = 3;
  const rings = Array.from({ length: ringCount }, (_, i) => {
    const ringFrame = frame - i * 0.25 * fps;
    const progress = interpolate(ringFrame % (3 * fps), [0, 3 * fps], [0, 1], {
      extrapolateRight: "clamp",
    });
    const scale = interpolate(progress, [0, 1], [0.5, 3]);
    const opacity = interpolate(progress, [0, 0.5, 1], [0.5, 0.2, 0]);
    return { scale, opacity, progress };
  });

  // "Travel with confidence" label
  const labelOp = interpolate(frame, [0.8 * fps, 1.3 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Headline: staggered words
  const headline = "Emergency SOS · Verified Guides · Location Sharing";
  const words = headline.split("·");

  // Feature pills
  const pills = ["GPS SOS Alert", "Verified Guides", "24/7 Support"];
  const pillOp = interpolate(frame, [2.5 * fps, 3.2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const pillY = interpolate(frame, [2.5 * fps, 3.2 * fps], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Checkmark tick animations in pills
  const tickSpring = spring({ frame: frame - 3 * fps, fps, config: { damping: 8 } });
  const tickScale = interpolate(tickSpring, [0, 1], [0, 1]);

  // Particle dots orbiting
  const orbitDots = [0, 1, 2, 3, 4].map((i) => {
    const angle = (i / 5) * Math.PI * 2 + frame * 0.02;
    const r = 130;
    return {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      op: interpolate(frame % (2 * fps), [0, fps / 2, fps, 1.5 * fps, 2 * fps], [0.2, 0.8, 0.2, 0.6, 0.2], {
        extrapolateRight: "clamp",
      }),
      size: 3 + (i % 2),
    };
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
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
      {/* Radar rings */}
      {rings.map((ring, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 260,
            height: 260,
            borderRadius: "50%",
            border: `1.5px solid ${color}`,
            opacity: ring.opacity * (0.4 - i * 0.08),
            transform: `scale(${ring.scale})`,
            left: "50%",
            top: "50%",
            marginLeft: -130,
            marginTop: -130,
          }}
        />
      ))}

      {/* Orbit dots */}
      {orbitDots.map((dot, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `calc(50% + ${dot.x}px)`,
            top: `calc(50% + ${dot.y}px)`,
            width: dot.size,
            height: dot.size,
            borderRadius: "50%",
            background: color,
            opacity: dot.op,
            boxShadow: `0 0 8px ${color}80`,
          }}
        />
      ))}

      {/* Shield + emoji */}
      <div
        style={{
          fontSize: 96,
          marginBottom: 28,
          transform: `scale(${shieldScale * breathe})`,
          filter: `drop-shadow(0 0 40px ${color}60)`,
          position: "relative",
          zIndex: 2,
        }}
      >
        🛡️
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: 18,
          color: "rgba(255,255,255,0.6)",
          marginBottom: 14,
          fontWeight: 500,
          opacity: labelOp,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          position: "relative",
          zIndex: 2,
        }}
      >
        Travel with confidence
      </div>

      {/* Headline with word stagger */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "6px 10px",
          marginBottom: 44,
          position: "relative",
          zIndex: 2,
        }}
      >
        {headline.split(/(?=·)|·/g).filter(Boolean).map((word, i) => {
          const wordOp = interpolate(
            frame,
            [1.2 * fps + i * 0.25 * fps, 1.7 * fps + i * 0.25 * fps],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
          );
          const wordY = interpolate(
            frame,
            [1.2 * fps + i * 0.25 * fps, 1.7 * fps + i * 0.25 * fps],
            [15, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
          );
          return (
            <span
              key={i}
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "white",
                textAlign: "center",
                lineHeight: 1.4,
                opacity: wordOp,
                transform: `translateY(${wordY}px)`,
                display: "inline-block",
              }}
            >
              {word}
              {i < 2 ? (
                <span
                  style={{
                    color,
                    margin: "0 4px",
                    fontWeight: 600,
                  }}
                >
                  ·
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      {/* Feature pills */}
      <div
        style={{
          display: "flex",
          gap: 18,
          opacity: pillOp,
          transform: `translateY(${pillY}px)`,
          position: "relative",
          zIndex: 2,
        }}
      >
        {pills.map((pill, i) => (
          <div
            key={i}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${color}50`,
              borderRadius: 30,
              padding: "12px 24px",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
              backdropFilter: "blur(8px)",
              transform: `scale(${tickScale})`,
              transformOrigin: "center",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: `${color}30`,
                border: `1.5px solid ${color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color,
                flexShrink: 0,
              }}
            >
              ✓
            </span>
            {pill}
          </div>
        ))}
      </div>
    </div>
  );
};
