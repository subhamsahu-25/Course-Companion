// frontend/src/pages/Showcase.jsx — post-signup section tour. Shown ONCE
// right after a successful signup (never after plain sign-in): a
// perspective carousel of every section in the new account's role. Each
// card carries a display button ("Start here") that picks the first
// screen after sign-in (persisted through email verification), with the
// button's explanation below it inside the card.
import { PerspectiveCarousel } from '../components/ui/perspective-carousel.jsx';
import { nameForRole, cardArt, sectionsForRole } from '../utils/showcase.js';

// User-supplied curly arrow artwork, recolored to the app palette
// (violet gradient). Height-driven: the art is tall and narrow.
function CurlyArrow({ height = 104, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="60 20 370 790"
      width={Math.round(height * 0.47)}
      height={height}
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient
          id="showcase-arrow-g"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="45"
          x2="0"
          y2="775"
        >
          <stop offset="0" stopColor="#A5A5FF" />
          <stop offset="0.5" stopColor="#7C7CF4" />
          <stop offset="1" stopColor="#4F4FD8" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke="url(#showcase-arrow-g)"
        strokeWidth="50"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M215 72 H325 Q350 74 342 100 L297 220" />
        <path d="M252 148 C168 196 116 290 132 388 C60 490 72 640 190 700 C262 740 330 745 385 750" />
        <path d="M140 410 C185 340 320 322 375 410 C405 485 320 562 235 512 C185 482 150 445 140 410" />
      </g>
    </svg>
  );
}

export default function Showcase({ role, onContinue }) {
  const sections = sectionsForRole(role);

  const items = sections.map((section) => ({
    src: cardArt(section.title),
    title: section.title,
    alt: `${section.title} preview`,
    page: section.page,
    blurb: section.blurb,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex flex-col items-center px-6 pt-6 text-center">
        <h1 className="font-sans text-2xl font-medium tracking-tight text-heading">
          Welcome{role ? `, ${nameForRole(role)}` : ''}
        </h1>
        <p className="mt-2 max-w-md text-[15px] text-body">
          Here&apos;s everything in your workspace.
        </p>
      </header>

      <main className="flex justify-center px-6">
        <div className="h-[360px] w-full max-w-4xl md:h-[380px]">
          <PerspectiveCarousel
            items={items}
            defaultActiveIndex={0}
            loop
            slideWidth={250}
            rotationStep={55}
            showDots={false}
            slideClassName="min-h-[240px] justify-center rounded-2xl border border-border bg-surface px-5 py-5 shadow-xl [&_button]:hidden [&_button]:outline-none"
            imageClassName="hidden"
            labelClassName="hidden"
            controlsClassName="border-border bg-surface text-heading"
            renderSlideContent={(item, index, isActive) => {
              const section = sections[index];
              if (!section || !isActive) return null;
              // Display-only section-name button with a minimal glow,
              // explanation below it, everything inside the card.
              return (
                <div className="flex min-h-[190px] w-full flex-col items-center px-1">
                  <span className="rounded-xl border border-accent bg-accent px-5 py-2 text-center text-base font-semibold text-accent-ink shadow-[0_0_26px_rgba(124,124,244,0.5)]">
                    {section.title}
                  </span>
                  <CurlyArrow height={94} className="mb-1 ml-[15px] mt-[6px] shrink-0 self-start" />
                  <p className="mt-auto max-w-[220px] text-center text-sm leading-6 text-body">
                    {section.blurb}
                  </p>
                </div>
              );
            }}
          />
        </div>
      </main>

      <footer className="mt-4 flex justify-center px-6 pb-6">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-xl border border-border bg-accent px-6 py-2.5 text-sm font-medium text-accent-ink transition-all duration-200 ease-out hover:bg-accent-hover active:scale-[0.98]"
        >
          Continue to sign in →
        </button>
      </footer>
    </div>
  );
}
