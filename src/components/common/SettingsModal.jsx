import { useState } from "react";
import {
  Palette,
  Sparkles,
  MessageCircle,
  Info,
} from "lucide-react";

import Modal from "./Modal";

function SettingsModal({
  open,
  onClose,
  theme,
  onThemeChange,
}) {
  const [animations, setAnimations] =
    useState(true);

  const handleThemeChange = (newTheme) => {
    onThemeChange(newTheme);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      size="large"
    >
      <div className="settings-layout">

        {/* APPEARANCE */}

        <div className="settings-section">
          <div className="settings-section-title">
            <Palette size={17} />

            <div>
              <strong>Appearance</strong>

              <span>
                Customize how Nova looks.
              </span>
            </div>
          </div>

          <div className="appearance-options">

            <button
              className={`appearance-card ${
                theme === "soft"
                  ? "selected"
                  : ""
              }`}
              onClick={() =>
                handleThemeChange("soft")
              }
            >
              <div className="appearance-preview soft-preview">
                <div />
                <div />
                <div />
              </div>

              <strong>Soft</strong>

              <span>
                Warm & elegant
              </span>
            </button>

            <button
              className={`appearance-card ${
                theme === "lavender"
                  ? "selected"
                  : ""
              }`}
              onClick={() =>
                handleThemeChange("lavender")
              }
            >
              <div className="appearance-preview lavender-preview">
                <div />
                <div />
                <div />
              </div>

              <strong>Lavender</strong>

              <span>
                Calm & creative
              </span>
            </button>

          </div>
        </div>

        {/* EXPERIENCE */}

        <div className="settings-section">
          <div className="settings-section-title">
            <Sparkles size={17} />

            <div>
              <strong>Experience</strong>

              <span>
                Control interface behavior.
              </span>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <strong>
                Interface animations
              </strong>

              <span>
                Use subtle animations throughout
                the interface.
              </span>
            </div>

            <button
              className={`toggle ${
                animations ? "on" : ""
              }`}
              onClick={() =>
                setAnimations(!animations)
              }
            >
              <span />
            </button>
          </div>
        </div>

        {/* CHAT */}

        <div className="settings-section">
          <div className="settings-section-title">
            <MessageCircle size={17} />

            <div>
              <strong>Chat</strong>

              <span>
                Conversation preferences.
              </span>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <strong>
                Enter to send
              </strong>

              <span>
                Press Enter to send messages.
              </span>
            </div>

            <div className="setting-status">
              Enabled
            </div>
          </div>
        </div>

        {/* INFO */}

        <div className="settings-about">
          <Info size={15} />

          <span>
            Nova is currently running in
            frontend demo mode. AI backend
            integration will be connected later.
          </span>
        </div>

      </div>
    </Modal>
  );
}

export default SettingsModal;