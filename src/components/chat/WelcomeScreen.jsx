import { Code2, Compass, Lightbulb, PenLine } from "lucide-react";

import { Tilt } from "../ui/primitives";

const SUGGESTIONS = [
  {
    icon: Lightbulb,
    title: "Explain a concept",
    prompt: "Explain how neural networks learn, using a simple analogy.",
  },
  {
    icon: Code2,
    title: "Write some code",
    prompt: "Write a Python function that removes duplicate items from a list while keeping order.",
  },
  {
    icon: PenLine,
    title: "Help me write",
    prompt: "Help me write a polite email asking my manager for a day off next Friday.",
  },
  {
    icon: Compass,
    title: "Plan something",
    prompt: "Plan a 3-day trip to Kerala with a mix of nature, food and culture.",
  },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function WelcomeScreen({ name, onPick }) {
  const firstName = name?.split(" ")[0];

  return (
    <section className="welcome" aria-labelledby="welcome-title">
      {/* The 3D orb floats in this space (rendered by the background scene). */}
      <div className="welcome-orb-space" aria-hidden="true" />

      <h1 id="welcome-title" className="welcome-title">
        {greeting()}
        {firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="welcome-subtitle">What would you like to explore today?</p>

      <div className="suggestions">
        {SUGGESTIONS.map(({ icon: Icon, title, prompt }, index) => (
          <Tilt
            as="button"
            type="button"
            key={title}
            className="suggestion-card glass"
            style={{ animationDelay: `${120 + index * 70}ms` }}
            onClick={() => onPick(prompt)}
          >
            <span className="suggestion-icon">
              <Icon size={18} aria-hidden="true" />
            </span>
            <strong>{title}</strong>
            <span className="suggestion-prompt">{prompt}</span>
          </Tilt>
        ))}
      </div>
    </section>
  );
}
