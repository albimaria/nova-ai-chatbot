import { CheckCircle, X } from "lucide-react";

function Toast({ message, visible, onClose }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="toast">
      <CheckCircle size={17} />

      <span>{message}</span>

      <button onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}

export default Toast;