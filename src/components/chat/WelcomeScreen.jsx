import {
  Sparkles,
  Lightbulb,
  Code2,
  PenLine,
  Brain,
} from "lucide-react";

const prompts = [
  {
    icon: Lightbulb,
    title: "Learn something",
    text: "Explain quantum computing like I'm a beginner",
  },
  {
    icon: Code2,
    title: "Write code",
    text: "Help me build a REST API with Node.js",
  },
  {
    icon: PenLine,
    title: "Write something",
    text: "Write a professional email requesting leave",
  },
  {
    icon: Brain,
    title: "Brainstorm",
    text: "Give me 10 innovative AI startup ideas",
  },
];

function WelcomeScreen({ onPromptClick }) {
  return (
    <div className="welcome-screen nova-hero">
      {/*
        Scoped, component-local styles only. index.css is untouched —
        these hooks layer on top of it and lean entirely on the
        existing theme variables (--accent, --accent-bright, --surface,
        --surface-soft, --text-primary, --text-secondary, etc.) so
        light/dark theming keeps working with zero color duplication.
      */}
      <style>{`
        .nova-hero {
          animation: novaHeroIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* ---------- orb ---------- */

        .nova-orb {
          position: relative;
          display: grid;
          place-items: center;
          animation: novaOrbFloat 6s ease-in-out infinite;
        }

        .nova-orb-glow {
          position: absolute;
          inset: -22px;
          border-radius: 50%;
          background: var(--accent);
          filter: blur(28px);
          opacity: 0.32;
          animation: novaGlowPulse 4s ease-in-out infinite;
          pointer-events: none;
        }

        .nova-orb-ring {
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          border: 1px solid var(--accent-bright, var(--accent));
          opacity: 0.35;
          pointer-events: none;
        }

        .nova-orb-ring::after {
          content: "";
          position: absolute;
          inset: -7px;
          border-radius: 50%;
          border: 1px solid var(--accent-bright, var(--accent));
          opacity: 0.16;
        }

        .nova-orb-core {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          color: var(--welcome-icon-fg, var(--accent));
        }

        /* ---------- headline ---------- */

        .nova-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 14px;
          padding: 5px 12px;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 10.5px;
          font-weight: 650;
          letter-spacing: 0.02em;
        }

        .nova-eyebrow span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 8px 1px var(--accent);
        }

        /* ---------- capability shortcuts ---------- */

        .nova-capabilities {
          gap: 8px;
        }

        .nova-capability {
          position: relative;
          overflow: hidden;
          animation: novaCardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: var(--nova-delay, 0ms);
        }

        .nova-capability::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent, var(--accent-soft), transparent);
          opacity: 0;
          transform: translateX(-30%);
          transition: opacity 0.3s ease, transform 0.5s ease;
          pointer-events: none;
        }

        .nova-capability:hover::before {
          opacity: 1;
          transform: translateX(30%);
        }

        .nova-capability-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .nova-capability:hover .nova-capability-icon {
          transform: scale(1.08) translateY(-1px);
        }

        @keyframes novaHeroIn {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes novaCardIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes novaOrbFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes novaGlowPulse {
          0%, 100% {
            opacity: 0.24;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.08);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .nova-hero,
          .nova-orb,
          .nova-orb-glow,
          .nova-capability {
            animation: none !important;
          }
        }
      `}</style>

      <div className="nova-eyebrow">
        <span />
        Nova
      </div>

      <div className="welcome-icon nova-orb" aria-hidden="true">
        <div className="nova-orb-glow" />
        <div className="nova-orb-ring" />
        <div className="nova-orb-core">
          <Sparkles size={25} strokeWidth={1.75} />
        </div>
      </div>

      <h1>How can I help you today?</h1>

      <p>
        Ask anything. Learn, create, solve problems,
        write, code, or explore ideas.
      </p>

      <div className="prompt-grid nova-capabilities">
        {prompts.map((prompt, index) => {
          const Icon = prompt.icon;

          return (
            <button
              key={prompt.title}
              type="button"
              className="prompt-card nova-capability"
              style={{ "--nova-delay": `${index * 70}ms` }}
              onClick={() => onPromptClick(prompt.text)}
            >
              <span className="nova-capability-icon">
                <Icon size={18} strokeWidth={1.75} />
              </span>

              <div>
                <strong>{prompt.title}</strong>

                <span>{prompt.text}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default WelcomeScreen;