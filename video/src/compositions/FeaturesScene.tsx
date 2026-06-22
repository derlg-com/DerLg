import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

interface FeaturesProps {
  color?: string;
}

const features = [
  { emoji: "🗺️", title: "Trip Discovery", desc: "Curated packages with smart suggestions", accent: "#f59e0b" },
  { emoji: "🏨", title: "Hotels & Stays", desc: "Hand-picked accommodations", accent: "#ec4899" },
  { emoji: "🚗", title: "Transport", desc: "Tuk-tuk, van, bus bookings", accent: "#8b5cf6" },
  { emoji: "💳", title: "QR Payments", desc: "Bakong / ABA / Stripe", accent: "#06b6d4" },
  { emoji: "🌐", title: "Multi-Language", desc: "English · 中文 · ភាសាខ្មែរ", accent: "#10b981" },
  { emoji: "📍", title: "Offline Maps", desc: "Navigate rural Cambodia", accent: "#f97316" },
];

export const FeaturesScene: React.FC<FeaturesProps> = ({ color = "#0f766e" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title: fade slide up
  const titleOp = interpolate(frame, [0, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const titleY = interpolate(frame, [0, 0.8 * fps], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Background subtle gradient shift
  const bgShift = interpolate(frame % (10 * fps), [0, 10 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(${160 + bgShift * 20}deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)`,
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
      {/* Ambient particles */}
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i / 20) * Math.PI * 2;
        const radius = 300 + Math.sin(i * 1.7) * 100;
        const px = 540 + Math.cos(angle + frame * 0.003) * radius;
        const py = 960 + Math.sin(angle + frame * 0.003) * radius;
        const pOp = interpolate(frame % (4 * fps), [0, 2 * fps, 4 * fps], [0, 0.3, 0], {
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              borderRadius: "50%",
              background: `rgba(148,163,184,${pOp})`,
            }}
          />
        );
      })}

      {/* Title */}
      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: "white",
          marginBottom: 48,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          maxWidth: 800,
          lineHeight: 1.3,
          letterSpacing: "-0.01em",
          position: "relative",
          zIndex: 2,
        }}
      >
        Everything you need to{" "}
        <span
          style={{
            background: `linear-gradient(135deg, ${color} 0%, #5eead4 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          travel Cambodia.
        </span>
      </div>

      {/* Feature grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 18,
          maxWidth: 900,
          position: "relative",
          zIndex: 2,
        }}
      >
        {features.map((f, i) => {
          // Staggered spring entrance per card
          const cardDelay = 0.5 * fps + i * 0.35 * fps;
          const cardFrame = frame - cardDelay;
          const cardSpring = spring({ frame: cardFrame, fps, config: { damping: 12, stiffness: 80 } });
          const cardScale = interpolate(cardSpring, [0, 1], [0.6, 1]);
          const cardY = interpolate(cardSpring, [0, 1], [30, 0]);
          const cardOp = interpolate(cardFrame, [0, 0.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Card hover-like pulse when visible
          const pulseScale = interpolate(frame % (2 * fps), [0, fps, 2 * fps], [1, 1.02, 1], {
            extrapolateRight: "clamp",
          });

          // Emoji bounce
          const emojiBounce = interpolate(frame % (3 * fps), [0, 1.5 * fps, 3 * fps], [0, -6, 0], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                background: `rgba(255,255,255,0.04)`,
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 18,
                padding: "22px 18px",
                textAlign: "center",
                opacity: cardOp,
                transform: `translateY(${cardY}px) scale(${cardScale * pulseScale})`,
                transition: "box-shadow 0.3s",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Top accent line */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "20%",
                  right: "20%",
                  height: 2,
                  borderRadius: 1,
                  background: f.accent,
                  opacity: 0.6,
                }}
              />

              {/* Emoji */}
              <div
                style={{
                  fontSize: 34,
                  marginBottom: 10,
                  transform: `translateY(${emojiBounce}px)`,
                  display: "inline-block",
                }}
              >
                {f.emoji}
              </div>

              {/* Title */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "white",
                  marginBottom: 6,
                  letterSpacing: "0.01em",
                }}
              >
                {f.title}
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.5,
                }}
              >
                {f.desc}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
