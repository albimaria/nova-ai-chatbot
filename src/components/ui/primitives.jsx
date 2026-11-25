import { Component, useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Accessible modal built on the native <dialog> element (focus trap + Esc for free). */
export function Dialog({ open, onClose, title, children, size = "md", footer }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${size}`}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      {open && (
        <div className="dialog-panel glass">
          <header className="dialog-header">
            <h2 id="dialog-title">{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </header>

          <div className="dialog-body">{children}</div>

          {footer && <footer className="dialog-footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** Card that tilts in 3D toward the pointer. */
export function Tilt({ as: Tag = "div", className = "", max = 10, children, ...props }) {
  const ref = useRef(null);

  const onMove = (event) => {
    const element = ref.current;
    if (!element || document.documentElement.dataset.motion === "off") return;

    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    element.style.setProperty("--rx", `${(-y * max).toFixed(2)}deg`);
    element.style.setProperty("--ry", `${(x * max).toFixed(2)}deg`);
    element.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
    element.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
  };

  const onLeave = () => {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty("--rx", "0deg");
    element.style.setProperty("--ry", "0deg");
  };

  return (
    <Tag
      ref={ref}
      className={`tilt ${className}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** Small CSS-only 3D orb used as Nova's logo and avatar. */
export function OrbBadge({ size = 32, busy = false }) {
  return (
    <span
      className={`orb-badge ${busy ? "busy" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/** If WebGL fails, show the CSS backdrop instead of crashing the app. */
export class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function Spinner({ size = 16 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}
