import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

export const SolutionScene: React.FC<{ tagline?: string; color?: string }> = ({
  tagline = "One chat. Your perfect trip.",
  color = "#0f766e",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone: spring entrance with overshoot
  const phoneSpring = spring({ frame, fps, config: { damping: 10, stiffness: 90 } });
  const phoneScale = interpolate(phoneSpring, [0, 1], [0.7, 1]);
  const phoneOpacity = interpolate(phoneSpring, [0, 0.5], [0, 1]);

  // Phone subtle float
  const floatY = interpolate(frame % (4 * fps), [0, 2 * fps, 4 * fps], [0, -8, 0], {
    extrapolateRight: "clamp",
  });

  // Screen glow pulse
  const glowPulse = interpolate(frame % (2 * fps), [0, fps, 2 * fps], [0.3, 0.5, 0.3], {
    extrapolateRight: "clamp",
  });

  // User bubble: slide from right
  const userBubbleX = interpolate(frame, [1 * fps, 1.6 * fps], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const userBubbleOp = interpolate(frame, [1 * fps, 1.3 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // AI bubble: slide from left with delay
  const aiBubbleX = interpolate(frame, [1.8 * fps, 2.5 * fps], [-40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const aiBubbleOp = interpolate(frame, [1.8 * fps, 2.2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Typing indicator dots
  const dotDance = (offset: number) =>
    interpolate((frame - 2.6 * fps - offset * 8) % (1 * fps), [0, 0.5 * fps, fps], [0, -6, 0], {
      extrapolateRight: "clamp",
    });

  // Tagline: spring in
  const tagSpring = spring({ frame, fps, config: { damping: 10, stiffness: 70 } });
  const tagY = interpolate(tagSpring, [0, 1], [30, 0]);
  const tagOp = interpolate(tagSpring, [0, 0.4], [0, 1]);

  // Background decorative shapes
  const floatShapes = [
    { size: 80, x: "8%", y: "12%", delay: 0, color: "#5eead4" },
    { size: 50, x: "85%", y: "20%", delay: 0.3, color: "#99f6e4" },
    { size: 100, x: "80%", y: "75%", delay: 0.6, color: "#ccfbf1" },
    { size: 40, x: "10%", y: "80%", delay: 0.2, color: "#5eead4" },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%)",
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
      {/* Decorative background shapes */}
      {floatShapes.map((s, i) => {
        const shapeFloat = interpolate((frame - s.delay * fps) % (5 * fps), [0, 2.5 * fps, 5 * fps], [0, -20, 0], {
          extrapolateRight: "clamp",
        });
        const shapeRot = interpolate((frame - s.delay * fps) % (8 * fps), [0, 8 * fps], [0, 45], {
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: `calc(${s.y} + ${shapeFloat}px)`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              background: s.color,
              opacity: 0.3,
              transform: `rotate(${shapeRot}deg)`,
              filter: "blur(40px)",
            }}
          />
        );
      })}

      {/* Phone */}
      <div
        style={{
          width: 280,
          height: 520,
          background: "white",
          borderRadius: 36,
          boxShadow: `0 0 80px rgba(15,118,110,${glowPulse}), 0 30px 80px rgba(15,118,110,0.2)`,
          opacity: phoneOpacity,
          transform: `scale(${phoneScale}) translateY(${floatY}px)`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "3px solid rgba(15,118,110,0.1)",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Header bar */}
        <div
          style={{
            background: `linear-gradient(135deg, ${color} 0%, #14b8a6 100%)`,
            padding: "16px 20px",
            color: "white",
            fontWeight: 600,
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.5)",
              animation: "none",
            }}
          />
          DerLg ✦ AI Concierge
        </div>

        {/* Chat area */}
        <div
          style={{
            flex: 1,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: "#fafcfb",
          }}
        >
          {/* User bubble */}
          <div
            style={{
              alignSelf: "flex-end",
              background: `linear-gradient(135deg, ${color} 0%, #14b8a6 100%)`,
              color: "white",
              padding: "12px 18px",
              borderRadius: 18,
              borderBottomRightRadius: 6,
              fontSize: 14,
              maxWidth: "80%",
              opacity: userBubbleOp,
              transform: `translateX(${userBubbleX}px)`,
              boxShadow: `0 4px 12px ${color}40`,
            }}
          >
            I want to visit Angkor Wat
          </div>

          {/* AI bubble */}
          <div
            style={{
              alignSelf: "flex-start",
              background: "white",
              color: "#1e293b",
              padding: "12px 18px",
              borderRadius: 18,
              borderBottomLeftRadius: 6,
              fontSize: 14,
              maxWidth: "85%",
              opacity: aiBubbleOp,
              transform: `translateX(${aiBubbleX}px)`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              border: "1px solid #e2e8f0",
            }}
          >
            Great choice! Here are the best temple tour packages...
          </div>

          {/* Typing indicator (animated dots) */}
          <div
            style={{
              alignSelf: "flex-start",
              opacity: interpolate(frame, [2.6 * fps, 3 * fps], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              display: "flex",
              gap: 5,
              padding: "8px 6px",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#94a3b8",
                  transform: `translateY(${dotDance(i)}px)`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color,
          marginTop: 40,
          textAlign: "center",
          opacity: tagOp,
          transform: `translateY(${tagY}px)`,
          lineHeight: 1.3,
          letterSpacing: "-0.01em",
          position: "relative",
          zIndex: 2,
        }}
      >
        {tagline}
      </div>
    </div>
  );
};
