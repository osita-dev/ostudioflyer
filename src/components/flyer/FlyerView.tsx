// ─────────────────────────────────────────────────────────────────────────────
// FlyerView — the DOM painter of the LayoutModel (preview === export, one
// layout model, two painters — Invariant 6). Renders the 1080×1920 flyer in a
// scaled container; the exporter paints the same model to canvas at 2×.
// ─────────────────────────────────────────────────────────────────────────────

import { CANVAS, FLYER_COLORS, FLYER_FONTS, SHELL } from "@/domain/shell";
import type { LaidText, LayoutModel } from "@/domain/layout";
import type { ShellAssets } from "@/services/assets";

interface Props {
  layout: LayoutModel | null;
  shell: ShellAssets | null;
  subjectImage: HTMLImageElement | null;
  width: number;
  empty?: boolean;
  className?: string;
}

function TextRun({ t }: { t: LaidText }) {
  return (
    <div
      style={{
        position: "absolute",
        left: t.x,
        top: t.y,
        fontFamily: FLYER_FONTS[t.font],
        fontSize: t.size,
        lineHeight: `${t.lineHeight}px`,
        fontWeight: t.weight,
        color: t.color,
        letterSpacing: t.tracking > 0 ? `${t.tracking}px` : undefined,
        whiteSpace: "pre",
        textAlign: t.align,
      }}
    >
      {t.lines.join("\n")}
    </div>
  );
}

function LogoFallback() {
  const l = SHELL.logo;
  return (
    <div
      style={{
        position: "absolute",
        left: l.x,
        top: l.y,
        width: l.w,
        height: l.h,
        color: FLYER_COLORS.gold,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          fontFamily: FLYER_FONTS.headline,
          fontSize: 96,
          fontWeight: 300,
          lineHeight: "96px",
        }}
      >
        O
      </span>
      <span style={{ textAlign: "center" }}>
        <span
          style={{
            display: "block",
            fontFamily: FLYER_FONTS.script,
            fontSize: 62,
            lineHeight: "62px",
          }}
        >
          studio
        </span>
        <span
          style={{
            display: "block",
            fontFamily: FLYER_FONTS.body,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "0.45em",
            paddingLeft: "0.45em",
          }}
        >
          INNOVATIONS
        </span>
      </span>
    </div>
  );
}

/** Reconstruction of the permanent shell, used until background-9x16.png exists. */
function ShellReconstruction({ shell }: { shell: ShellAssets | null }) {
  const p = SHELL.panel;
  const fy = SHELL.footer.y;
  const lines = Array.from({ length: 8 }, (_, i) => i);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: FLYER_COLORS.black }} />

      {/* gold diagonal clusters */}
      {lines.map((i) => (
        <div key={`tl-${i}`}>
          <div
            style={{
              position: "absolute",
              left: -260 + i * 42,
              top: 0,
              width: 735,
              height: 2,
              background: FLYER_COLORS.gold,
              opacity: 0.25 + (i % 3) * 0.2,
              transformOrigin: "0 50%",
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: CANVAS.w - (260 + i * 42),
              top: CANVAS.h,
              width: 735,
              height: 2,
              background: FLYER_COLORS.gold,
              opacity: 0.25 + (i % 3) * 0.2,
              transformOrigin: "0 50%",
              transform: "rotate(-135deg)",
            }}
          />
        </div>
      ))}

      {/* white paper panel + roll */}
      <div
        style={{
          position: "absolute",
          left: p.x,
          top: p.y,
          width: p.w,
          height: p.h,
          background: FLYER_COLORS.paper,
          borderRadius: p.radius,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: p.x,
          top: p.y,
          width: SHELL.roll.w,
          height: p.h,
          borderRadius: `${p.radius}px 0 0 ${p.radius}px`,
          background:
            "linear-gradient(90deg, #E7E2D6 0%, #FBFAF6 55%, #F2EEE4 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: p.x,
          top: p.y - 14,
          width: SHELL.roll.w,
          height: 34,
          borderRadius: 999,
          background: FLYER_COLORS.gold,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: p.x + 12,
          top: p.y - 7,
          width: SHELL.roll.w - 24,
          height: 18,
          borderRadius: 999,
          background: "#C79A2E",
        }}
      />

      {/* logo (asset or fallback) */}
      {shell?.logo ? (
        <img
          src={shell.logo.src}
          alt="O Studio Innovations"
          style={{
            position: "absolute",
            left: SHELL.logo.x,
            top: SHELL.logo.y,
            width: SHELL.logo.w,
            height: SHELL.logo.h,
            objectFit: "contain",
          }}
        />
      ) : (
        <LogoFallback />
      )}

      {/* footer */}
      <div
        style={{
          position: "absolute",
          left: 250,
          top: fy + 17,
          width: 245,
          height: 2,
          background: FLYER_COLORS.gold,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 585,
          top: fy + 17,
          width: 245,
          height: 2,
          background: FLYER_COLORS.gold,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 510,
          top: fy + 2,
          width: 60,
          height: 36,
          border: `2px solid ${FLYER_COLORS.gold}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 4,
            top: 2,
            width: 46,
            height: 46,
            borderRight: `2px solid ${FLYER_COLORS.gold}`,
            borderBottom: `2px solid ${FLYER_COLORS.gold}`,
            transform: "rotate(45deg) skew(-8deg, -8deg)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: fy + 80,
          width: CANVAS.w,
          textAlign: "center",
          fontFamily: FLYER_FONTS.body,
          fontSize: 34,
          color: FLYER_COLORS.gold,
        }}
      >
        {SHELL.footer.email}
      </div>
    </>
  );
}

export function FlyerView({ layout, shell, subjectImage, width, empty, className }: Props) {
  const height = (width * CANVAS.h) / CANVAS.w;
  const scale = width / CANVAS.w;
  const hasBackgroundAsset = !!shell?.background;
  const b = layout?.image;

  return (
    <div
      className={className}
      style={{ width, height, overflow: "hidden", borderRadius: 12, position: "relative" }}
    >
      <div
        style={{
          width: CANVAS.w,
          height: CANVAS.h,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
          background: hasBackgroundAsset ? undefined : FLYER_COLORS.black,
        }}
      >
        {/* permanent shell */}
        {hasBackgroundAsset ? (
          <img
            src={shell!.background!.src}
            alt=""
            style={{ position: "absolute", inset: 0, width: CANVAS.w, height: CANVAS.h }}
          />
        ) : (
          <ShellReconstruction shell={shell} />
        )}

        {/* empty state — the shell still teaches the design (step 06) */}
        {empty && (
          <div
            style={{
              position: "absolute",
              left: SHELL.safe.x,
              top: SHELL.safe.y + 180,
              width: SHELL.safe.w,
              textAlign: "center",
              fontFamily: FLYER_FONTS.body,
              fontSize: 40,
              lineHeight: "60px",
              color: FLYER_COLORS.muted,
              opacity: 0.7,
            }}
          >
            Your next message will appear here.
            <br />
            Press Generate.
          </div>
        )}

        {/* dynamic content */}
        {layout && (
          <>
            {b && subjectImage && (
              <img
                src={subjectImage.src}
                alt=""
                style={
                  shell?.mask
                    ? {
                        position: "absolute",
                        left: b.x,
                        top: b.y,
                        width: b.w,
                        height: b.h,
                        objectFit: "cover",
                        maskImage: `url(${shell.mask.src})`,
                        WebkitMaskImage: `url(${shell.mask.src})`,
                        maskSize: "100% 100%",
                        WebkitMaskSize: "100% 100%",
                      }
                    : {
                        position: "absolute",
                        left: b.x,
                        top: b.y,
                        width: b.w,
                        height: b.h,
                        objectFit: "cover",
                        borderRadius: SHELL.imageBox.radius,
                      }
                }
              />
            )}
            {layout.rules.map((r, i) => (
              <div
                key={`rule-${i}`}
                style={{
                  position: "absolute",
                  left: r.x,
                  top: r.y,
                  width: r.w,
                  height: r.h,
                  background: r.color,
                }}
              />
            ))}
            {layout.texts.map((t, i) => (
              <TextRun key={`text-${i}`} t={t} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
