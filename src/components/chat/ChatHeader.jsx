import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Share2,
  MoreHorizontal,
  Check,
} from "lucide-react";

function ChatHeader({
  title = "New conversation",
  selectedModel = "Nova Standard",
  setSelectedModel,
}) {
  const models = [
    "Nova Fast",
    "Nova Standard",
    "Nova Reasoning",
  ];

  const [modelOpen, setModelOpen] = useState(false);
  const modelRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        modelRef.current &&
        !modelRef.current.contains(event.target)
      ) {
        setModelOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  const handleModelSelect = (model) => {
    setSelectedModel?.(model);
    setModelOpen(false);
  };

  return (
    <header className="chat-header nova-header">
      <style>{`
        .nova-header {
          position: relative;
          animation: novaHeaderIn 0.4s
            cubic-bezier(0.16, 1, 0.3, 1)
            both;
        }

        .nova-header::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 1px;

          background: linear-gradient(
            90deg,
            transparent,
            var(--border) 15%,
            var(--border) 85%,
            transparent
          );

          pointer-events: none;
        }

        .nova-title {
          position: relative;
          font-weight: 600;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nova-header-actions {
          gap: 7px;
        }

        /* =========================
           MODEL SELECTOR
        ========================= */

        .nova-model-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .nova-model-trigger {
          position: relative;

          display: flex;
          align-items: center;
          gap: 9px;

          height: 36px;
          min-width: 150px;

          padding: 0 11px;

          border-radius: 999px;

          background:
            linear-gradient(
              135deg,
              var(--surface-soft),
              var(--surface)
            );

          border: 1px solid var(--border);

          color: var(--text-primary, var(--text));

          cursor: pointer;

          transition:
            background 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            transform 0.15s ease;
        }

        .nova-model-trigger:hover {
          background: var(--surface-hover);

          border-color:
            var(--accent-bright, var(--accent));

          box-shadow:
            0 0 0 3px var(--accent-soft);
        }

        .nova-model-trigger:active {
          transform: scale(0.98);
        }

        .nova-model-dot {
          flex-shrink: 0;

          width: 7px;
          height: 7px;

          border-radius: 50%;

          background:
            var(--accent-bright, var(--accent));

          box-shadow:
            0 0 8px 1px var(--accent-soft);
        }

        .nova-model-current {
          flex: 1;

          min-width: 0;

          font-size: 12px;
          font-weight: 650;

          text-align: left;

          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nova-model-chevron {
          flex-shrink: 0;

          color: var(--text-muted);

          transition:
            transform 0.2s ease,
            color 0.2s ease;
        }

        .nova-model-trigger.open
          .nova-model-chevron {
          transform: rotate(180deg);

          color:
            var(--accent-bright, var(--accent));
        }

        /* =========================
           CUSTOM MODEL MENU
        ========================= */

        .nova-model-menu {
          position: absolute;

          top: calc(100% + 8px);
          right: 0;

          width: 190px;

          padding: 6px;

          z-index: 10000;

          background:
            linear-gradient(
              145deg,
              var(--surface),
              var(--surface-soft)
            );

          border: 1px solid var(--border);

          border-radius: 14px;

          box-shadow:
            0 18px 45px rgba(0, 0, 0, 0.28),
            0 5px 15px rgba(0, 0, 0, 0.15);

          backdrop-filter: blur(18px);

          animation:
            novaModelMenuIn 0.16s
            cubic-bezier(0.16, 1, 0.3, 1)
            both;
        }

        .nova-model-option {
          width: 100%;

          display: flex;
          align-items: center;
          gap: 9px;

          min-height: 38px;

          padding: 8px 10px;

          border: 0;
          border-radius: 9px;

          background: transparent;

          color:
            var(--text-primary, var(--text));

          font-size: 12px;
          font-weight: 550;

          text-align: left;

          cursor: pointer;

          transition:
            background 0.15s ease,
            color 0.15s ease,
            transform 0.15s ease;
        }

        .nova-model-option:hover {
          background: var(--surface-hover);

          color:
            var(--accent-bright, var(--accent));

          transform: translateX(2px);
        }

        .nova-model-option.active {
          background: var(--accent-soft);

          color:
            var(--accent-bright, var(--accent));
        }

        .nova-model-option-dot {
          width: 6px;
          height: 6px;

          flex-shrink: 0;

          border-radius: 50%;

          background: var(--text-muted);

          transition:
            background 0.15s ease,
            box-shadow 0.15s ease;
        }

        .nova-model-option.active
          .nova-model-option-dot {
          background:
            var(--accent-bright, var(--accent));

          box-shadow:
            0 0 7px var(--accent-soft);
        }

        .nova-model-check {
          margin-left: auto;

          color:
            var(--accent-bright, var(--accent));
        }

        /* =========================
           ICON BUTTONS
        ========================= */

        .nova-icon-button {
          display: grid;
          place-items: center;

          width: 34px;
          height: 34px;

          border-radius: 9px;

          background: transparent;

          border: 1px solid transparent;

          color: var(--text-secondary);

          transition:
            background 0.18s ease,
            border-color 0.18s ease,
            color 0.18s ease,
            transform 0.15s ease;
        }

        .nova-icon-button:hover {
          background: var(--surface-hover);

          border-color: var(--border);

          color: var(--text);

          transform: translateY(-1px);
        }

        .nova-icon-button:active {
          transform: translateY(0) scale(0.94);
        }

        @keyframes novaHeaderIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes novaModelMenuIn {
          from {
            opacity: 0;
            transform: translateY(-5px) scale(0.97);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .nova-header,
          .nova-icon-button,
          .nova-model-menu,
          .nova-model-trigger,
          .nova-model-option {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 768px) {
          .nova-model-trigger {
            min-width: 125px;
            height: 34px;
          }

          .nova-model-current {
            font-size: 11.5px;
          }

          .nova-model-menu {
            width: 175px;
          }

          .nova-icon-button {
            width: 32px;
            height: 32px;
          }
        }
      `}</style>

      <div className="chat-title nova-title">
        {title}
      </div>

      <div className="header-actions nova-header-actions">

        {/* MODEL SELECTOR */}

        <div
          className="model-wrapper nova-model-wrapper"
          ref={modelRef}
        >
          <button
            type="button"
            className={`nova-model-trigger ${modelOpen ? "open" : ""
              }`}
            onClick={() =>
              setModelOpen((open) => !open)
            }
            aria-haspopup="listbox"
            aria-expanded={modelOpen}
          >
            <span
              className="nova-model-dot"
              aria-hidden="true"
            />

            <span className="nova-model-current">
              {selectedModel}
            </span>

            <ChevronDown
              size={14}
              className="nova-model-chevron"
            />
          </button>

          {modelOpen && (
            <div
              className="nova-model-menu"
              role="listbox"
            >
              {models.map((model) => {
                const isActive =
                  selectedModel === model;

                return (
                  <button
                    key={model}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`nova-model-option ${isActive ? "active" : ""
                      }`}
                    onClick={() =>
                      handleModelSelect(model)
                    }
                  >
                    <span
                      className="nova-model-option-dot"
                      aria-hidden="true"
                    />

                    <span>{model}</span>

                    {isActive && (
                      <Check
                        size={14}
                        className="nova-model-check"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* SHARE */}

        <button
          type="button"
          className="icon-button nova-icon-button"
          title="Share"
        >
          <Share2 size={17} />
        </button>

        {/* MORE */}

        <button
          type="button"
          className="icon-button nova-icon-button"
          title="More options"
        >
          <MoreHorizontal size={17} />
        </button>
      </div>
    </header>
  );
}

export default ChatHeader;