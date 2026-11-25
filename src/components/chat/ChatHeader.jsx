import { useEffect, useRef, useState } from "react";
import { Brain, Check, ChevronDown, Gauge, Menu, Share2, Zap } from "lucide-react";

const MODEL_META = {
  "Nova Fast": { icon: Zap, description: "Quickest answers for everyday questions" },
  "Nova Standard": { icon: Gauge, description: "Balanced speed and quality" },
  "Nova Reasoning": { icon: Brain, description: "Thinks longer on hard problems" },
};

function ModelPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const itemsRef = useRef([]);
  const models = Object.keys(MODEL_META);

  useEffect(() => {
    if (!open) return undefined;

    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);

    const index = Math.max(0, models.indexOf(value));
    itemsRef.current[index]?.focus();

    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMenuKey = (event) => {
    const index = itemsRef.current.indexOf(document.activeElement);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = (index + (event.key === "ArrowDown" ? 1 : -1) + models.length) % models.length;
      itemsRef.current[next]?.focus();
    }

    if (event.key === "Escape" || event.key === "Tab") setOpen(false);
  };

  const Icon = MODEL_META[value]?.icon || Gauge;

  return (
    <div className="model-picker" ref={rootRef}>
      <button
        type="button"
        className="model-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon size={16} aria-hidden="true" />
        <span>{value}</span>
        <ChevronDown size={15} className={open ? "rotated" : ""} aria-hidden="true" />
      </button>

      {open && (
        <div className="model-menu glass" role="menu" aria-label="Choose a model" onKeyDown={onMenuKey}>
          {models.map((model, index) => {
            const meta = MODEL_META[model];
            const ItemIcon = meta.icon;
            return (
              <button
                key={model}
                ref={(element) => {
                  itemsRef.current[index] = element;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={model === value}
                className={`model-option ${model === value ? "selected" : ""}`}
                onClick={() => {
                  onChange(model);
                  setOpen(false);
                }}
              >
                <span className="model-option-icon">
                  <ItemIcon size={17} />
                </span>
                <span className="model-option-text">
                  <strong>{model}</strong>
                  <small>{meta.description}</small>
                </span>
                {model === value && <Check size={16} className="model-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ChatHeader({ model, onModelChange, title, onOpenSidebar, showMenuButton, onShare }) {
  return (
    <header className="chat-header">
      <div className="chat-header-left">
        {showMenuButton && (
          <button type="button" className="icon-btn" onClick={onOpenSidebar} aria-label="Open sidebar">
            <Menu size={20} />
          </button>
        )}
        <ModelPicker value={model} onChange={onModelChange} />
      </div>

      {title && <h2 className="chat-title">{title}</h2>}

      <div className="chat-header-right">
        {onShare && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onShare}>
            <Share2 size={15} aria-hidden="true" />
            <span className="hide-sm">Share</span>
          </button>
        )}
      </div>
    </header>
  );
}
