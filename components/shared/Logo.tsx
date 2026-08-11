import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  className?: string;
};

// The brain-and-house mark sits to the LEFT of "RENTALintel", baseline-
// aligned with it — the house's own visual bottom sits on the same line as
// the wordmark's text baseline (and, via app/layout.tsx's own
// `items-baseline`, the same line as the Account/Login-Signup button's text
// too). That only works because /brand/logo.webp is cropped tight to the
// artwork's actual ink (533x536, no surrounding transparent margin) —
// nothing in the artwork itself is touched, this only trims empty space —
// so the image element's own bottom edge (which is what a flex item without
// a text baseline contributes to `items-baseline` alignment) lands right at
// the house's bottom instead of somewhere in a padding void beneath it. The
// full, untrimmed master lives at public/brand/source purely as a source
// asset and is never referenced by the app.
//
// "intel" is a real, unmodified lowercase word colored red as a whole
// (`text-danger` on the span) — not a dotless-i plus a separately positioned
// circle standing in for the dot. That earlier per-dot approach needed
// pixel-measured offsets to keep the dot centered over the stem; coloring
// the actual glyph needs none of that, and the dot is red because the glyph
// is, not because a second shape sits on top of it. The accessible name is
// the plain, correctly-spelled "RentalIntel" via the sr-only span below —
// the visual lockup is decorative/aria-hidden.
export default function Logo({ className = "" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`inline-flex items-baseline gap-0.5 text-foreground transition-colors hover:text-accent ${className}`}
    >
      <span className="sr-only">RentalIntel</span>
      <Image
        src="/brand/logo.webp"
        alt=""
        width={533}
        height={536}
        priority
        // The image's own bottom edge is what `items-baseline` uses to
        // align it with the wordmark's text baseline — but that edge
        // includes the artwork's soft drop shadow beneath the house, which
        // extends a couple of pixels below the house's actual solid-color
        // base. Measured directly (color-distance from the background, to
        // exclude the shadow): the solid wall's true bottom sits ~1.25px
        // above the text baseline. This nudges just the image down by that
        // amount so the house's real base — not its shadow — lines up with
        // "RENTAL"'s baseline.
        style={{ transform: "translateY(1.25px)" }}
        className="h-9 w-auto shrink-0 sm:h-10"
      />
      <span
        aria-hidden="true"
        className="text-sm font-medium tracking-[0.14em] whitespace-nowrap"
      >
        RENTAL<span className="text-danger">intel</span>
      </span>
    </Link>
  );
}
