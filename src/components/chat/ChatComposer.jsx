import {
  useRef,
  useState,
} from "react";

import {
  Plus,
  Mic,
  ArrowUp,
  Square,
  X,
  FileText,
  Image,
} from "lucide-react";


function ChatComposer({
  onSend,
  onStop,
  disabled,
}) {

  const [message, setMessage] =
    useState("");

  const [attachments, setAttachments] =
    useState([]);

  const [recording, setRecording] =
    useState(false);


  const recognitionRef =
    useRef(null);

  const textareaRef =
    useRef(null);

  const fileInputRef =
    useRef(null);

  const finalTranscriptRef =
    useRef("");


  /*
   * RESIZE TEXTAREA
   */

  const resizeTextarea = () => {

    const textarea =
      textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height =
      "auto";

    textarea.style.height =
      `${Math.min(
        textarea.scrollHeight,
        180
      )}px`;
  };


  /*
   * TEXT CHANGE
   */

  const handleChange = (
    event
  ) => {

    setMessage(
      event.target.value
    );

    resizeTextarea();
  };


  /*
   * SELECT FILES
   */

  const handleFiles = (
    event
  ) => {

    const selectedFiles =
      Array.from(
        event.target.files
      );


    if (
      selectedFiles.length === 0
    ) {
      return;
    }


    /*
     * KEEP THE ACTUAL FILE
     *
     * This is important.
     *
     * Before:
     * name / type / size only
     *
     * Now:
     * file = actual browser File
     */

    const fileData =
      selectedFiles.map(
        (file) => ({
          file,

          name:
            file.name,

          type:
            file.type,

          size:
            file.size,
        })
      );


    setAttachments(
      (previous) => [
        ...previous,
        ...fileData,
      ]
    );


    /*
     * Allow selecting the
     * same file again later.
     */

    event.target.value = "";
  };


  /*
   * REMOVE ATTACHMENT
   */

  const removeAttachment = (
    index
  ) => {

    setAttachments(
      (previous) =>
        previous.filter(
          (
            _,
            fileIndex
          ) =>
            fileIndex !==
            index
        )
    );
  };


  /*
   * FORMAT FILE SIZE
   */

  const formatFileSize = (
    size
  ) => {

    if (!size) {
      return "";
    }


    if (
      size < 1024
    ) {
      return `${size} B`;
    }


    if (
      size <
      1024 * 1024
    ) {
      return `${Math.round(
        size / 1024
      )} KB`;
    }


    return `${(
      size /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  };


  /*
   * SEND MESSAGE
   */

  const submitMessage = async (
    text = message,
    currentAttachments =
      attachments
  ) => {

    const trimmedMessage =
      text.trim();


    if (
      !trimmedMessage &&
      currentAttachments.length === 0
    ) {
      return;
    }


    if (disabled) {
      return;
    }


    /*
     * Clear composer UI
     */

    setMessage("");

    setAttachments([]);


    if (
      textareaRef.current
    ) {

      textareaRef.current.style.height =
        "auto";
    }


    /*
     * Pass the actual files
     * to ChatLayout.
     */

    await onSend(
      trimmedMessage,
      currentAttachments
    );
  };


  /*
   * STOP VOICE + SEND
   */

  const stopListeningAndSend =
    () => {

      if (!recording) {
        return;
      }


      const recognition =
        recognitionRef.current;


      if (recognition) {
        recognition.stop();
      }


      setRecording(false);


      const spokenText =
        finalTranscriptRef.current
          .trim();


      if (spokenText) {

        setMessage(
          spokenText
        );


        submitMessage(
          spokenText,
          attachments
        );
      }


      finalTranscriptRef.current =
        "";
    };


  /*
   * VOICE INPUT
   */

  const toggleRecording = () => {

    if (disabled) {
      return;
    }


    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

      alert(
        "Speech recognition is not supported in this browser. Please use Google Chrome."
      );

      return;
    }


    /*
     * Stop current recording
     */

    if (recording) {

      stopListeningAndSend();

      return;
    }


    const recognition =
      new SpeechRecognition();


    recognition.continuous =
      true;

    recognition.interimResults =
      true;

    recognition.lang =
      "en-IN";


    finalTranscriptRef.current =
      "";


    recognition.onstart = () => {
      setRecording(true);
    };


    recognition.onresult = (
      event
    ) => {

      let interimTranscript =
        "";


      for (
        let i =
          event.resultIndex;

        i <
        event.results.length;

        i++
      ) {

        const transcript =
          event.results[i][0]
            .transcript;


        if (
          event.results[i]
            .isFinal
        ) {

          finalTranscriptRef.current +=
            transcript + " ";

        } else {

          interimTranscript +=
            transcript;
        }
      }


      const combinedText =
        `${finalTranscriptRef.current} ${interimTranscript}`
          .replace(
            /\s+/g,
            " "
          )
          .trim();


      setMessage(
        combinedText
      );


      setTimeout(
        resizeTextarea,
        0
      );
    };


    recognition.onerror = (
      event
    ) => {

      console.error(
        "Speech recognition error:",
        event.error
      );

      setRecording(false);
    };


    recognition.onend = () => {
      setRecording(false);
    };


    recognitionRef.current =
      recognition;


    recognition.start();
  };


  /*
   * KEYBOARD HANDLING
   */

  const handleKeyDown = (
    event
  ) => {

    /*
     * ENTER WHILE LISTENING
     */

    if (
      event.key === "Enter" &&
      recording
    ) {

      event.preventDefault();

      stopListeningAndSend();

      return;
    }


    /*
     * NORMAL ENTER
     */

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      submitMessage();
    }
  };


  const hasContent =
    message.trim().length > 0 ||
    attachments.length > 0;


  return (
    <div className="composer-container nova-composer-container">

      {/*
        Scoped, component-local styles only — index.css is untouched.
        Every rule here reads its color from the existing theme
        variables (--accent, --accent-bright, --surface, --surface-hover,
        --border, --text, --text-muted, --app-bg) so light and dark
        theming keep working with no second color system.
      */}
      <style>{`
        .nova-composer-container {
  position: absolute !important;
  left: 50% !important;
  right: auto !important;
  bottom: 18px !important;
  transform: translateX(-50%) !important;

  width: min(900px, calc(100% - 40px)) !important;
  max-width: 900px !important;
  min-width: 0 !important;

  margin: 0 !important;
  padding: 0 !important;

  box-sizing: border-box !important;

  z-index: 9999 !important;

  animation: novaComposerIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

        /* ---------- attachments ---------- */

        .nova-attachment-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        }

        .nova-attachment-chip {
          position: relative;
          display: flex;
          align-items: center;
          gap: 9px;
          max-width: 240px;
          padding: 7px 10px 7px 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 999px;
          box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.08));
          animation: novaChipIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }

        .nova-attachment-chip:hover {
          border-color: var(--accent-bright, var(--accent));
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.1));
        }

        .nova-attachment-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--accent-soft);
          color: var(--accent);
        }

        .nova-attachment-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          line-height: 1.25;
        }

        .nova-attachment-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-primary, var(--text));
          font-size: 11.5px;
          font-weight: 600;
        }

        .nova-attachment-size {
          color: var(--text-muted);
          font-size: 9.5px;
        }

        .nova-attachment-remove {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          margin-left: 2px;
          border-radius: 50%;
          background: transparent;
          color: var(--text-muted);
          transition: background 0.18s ease, color 0.18s ease;
        }

        .nova-attachment-remove:hover {
          background: var(--surface-hover);
          color: var(--text);
        }

        /* ---------- composer shell ---------- */

        .nova-composer-shell {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 6px;

  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;

  padding: 9px 10px 9px 12px;

  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 26px;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.03) inset,
    var(--shadow-lg, 0 20px 45px rgba(0, 0, 0, 0.25));

  backdrop-filter: blur(20px);

  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease,
    transform 0.25s ease;
}

        .nova-composer-shell::before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: 27px;
          padding: 1px;
          background: linear-gradient(135deg, var(--accent-bright, var(--accent)), transparent 40%);
          opacity: 0;
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }

        .nova-composer-shell:focus-within {
          border-color: var(--accent-bright, var(--accent));
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.04) inset,
            0 0 0 4px var(--accent-soft),
            var(--shadow-lg, 0 22px 50px rgba(0, 0, 0, 0.3));
        }

        .nova-composer-shell:focus-within::before {
          opacity: 0.55;
        }

        /* ---------- circular action buttons ---------- */

        .nova-icon-btn {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: transparent;
          color: var(--text-muted);
          transition:
            background 0.2s ease,
            color 0.2s ease,
            transform 0.15s ease;
        }

        .nova-icon-btn:hover:not(:disabled) {
          background: var(--surface-hover);
          color: var(--text);
          transform: translateY(-1px);
        }

        .nova-icon-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.94);
        }

        .nova-icon-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* ---------- mic ---------- */

        .nova-mic-btn {
          position: relative;
        }

        .nova-mic-btn.nova-recording {
          background: var(--accent-soft);
          color: var(--accent);
        }

        .nova-mic-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1.5px solid var(--accent-bright, var(--accent));
          opacity: 0;
          pointer-events: none;
        }

        .nova-mic-btn.nova-recording .nova-mic-ring {
          animation: novaMicPulse 1.6s ease-out infinite;
        }

        .nova-mic-btn.nova-recording svg {
          animation: novaMicBeat 1.2s ease-in-out infinite;
        }

        /* ---------- textarea ---------- */

        .nova-textarea {
          flex: 1;
          min-width: 0;
          min-height: 38px;
          max-height: 180px;
          margin: 0 2px;
          padding: 9px 4px;
          resize: none;
          border: none;
          outline: none;
          background: transparent;
          color: var(--text-primary, var(--text));
          font: inherit;
          font-size: 14.5px;
          line-height: 1.55;
          scrollbar-width: none;
        }

        .nova-textarea::-webkit-scrollbar {
          display: none;
        }

        .nova-textarea::placeholder {
          color: var(--text-muted);
          transition: color 0.2s ease;
        }

        /* ---------- send / stop ---------- */

        .nova-send-btn {
          position: relative;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--surface-hover);
          color: var(--text-muted);
          transition:
            background 0.2s ease,
            color 0.2s ease,
            box-shadow 0.25s ease,
            transform 0.15s ease;
        }

        .nova-send-btn.nova-active {
          background: linear-gradient(155deg, var(--accent-bright, var(--accent)), var(--accent));
          color: var(--accent-fg, #fff);
          box-shadow: 0 6px 18px var(--accent-soft), 0 2px 6px var(--accent-soft);
        }

        .nova-send-btn.nova-active:hover:not(:disabled) {
          transform: translateY(-1px) scale(1.04);
          box-shadow: 0 10px 26px var(--accent-soft), 0 2px 8px var(--accent-soft);
        }

        .nova-send-btn.nova-active:active:not(:disabled) {
          transform: translateY(0) scale(0.96);
        }

        .nova-send-btn.nova-stop {
          background: var(--accent);
          color: var(--accent-fg, #fff);
          box-shadow: 0 6px 16px var(--accent-soft);
        }

        .nova-send-btn.nova-stop::after {
          content: "";
          position: absolute;
          inset: -5px;
          border-radius: 50%;
          border: 1.5px solid var(--accent-bright, var(--accent));
          opacity: 0.4;
          animation: novaStopPulse 1.8s ease-in-out infinite;
        }

        .nova-send-btn:disabled {
          cursor: not-allowed;
        }

        /* ---------- disclaimer ---------- */

        .nova-disclaimer {
          margin-top: 9px;
          text-align: center;
          color: var(--text-muted);
          font-size: 9.5px;
          letter-spacing: 0.01em;
        }

        /* ---------- keyframes ---------- */

        @keyframes novaComposerIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes novaChipIn {
          from { opacity: 0; transform: translateY(6px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes novaMicPulse {
          0% { transform: scale(1); opacity: 0.55; }
          100% { transform: scale(1.5); opacity: 0; }
        }

        @keyframes novaMicBeat {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }

        @keyframes novaStopPulse {
          0%, 100% { transform: scale(1); opacity: 0.45; }
          50% { transform: scale(1.18); opacity: 0.1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nova-composer-container,
          .nova-attachment-chip,
          .nova-mic-ring,
          .nova-mic-btn.nova-recording svg,
          .nova-send-btn.nova-stop::after {
            animation: none !important;
          }
        }

        @media (max-width: 768px) {
          .nova-composer-shell {
            border-radius: 22px;
            padding: 7px 8px 7px 10px;
          }

          .nova-icon-btn,
          .nova-send-btn {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>

      {attachments.length >
        0 && (
          <div className="attachment-list nova-attachment-list">

            {attachments.map(
              (
                file,
                index
              ) => (

                <div
                  className="attachment-chip nova-attachment-chip"
                  key={`${file.name}-${index}`}
                  style={{ animationDelay: `${index * 40}ms` }}
                >

                  <div className="attachment-icon nova-attachment-icon">

                    {file.type?.startsWith(
                      "image/"
                    ) ? (
                      <Image
                        size={13}
                      />
                    ) : (
                      <FileText
                        size={13}
                      />
                    )}

                  </div>


                  <div className="attachment-info nova-attachment-info">

                    <span className="attachment-name nova-attachment-name">
                      {file.name}
                    </span>


                    <span className="attachment-size nova-attachment-size">
                      {formatFileSize(
                        file.size
                      )}
                    </span>

                  </div>


                  <button
                    type="button"
                    className="attachment-remove nova-attachment-remove"
                    onClick={() =>
                      removeAttachment(
                        index
                      )
                    }
                    disabled={
                      disabled
                    }
                    title="Remove attachment"
                  >
                    <X size={13} />
                  </button>

                </div>
              )
            )}

          </div>
        )}


      <div className="composer nova-composer-shell">

        <button
          type="button"
          className="composer-button nova-icon-btn"
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={
            disabled
          }
          title="Attach file"
        >
          <Plus size={19} />
        </button>


        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          onChange={
            handleFiles
          }
        />


        <textarea
          ref={textareaRef}
          className="nova-textarea"
          value={message}
          onChange={
            handleChange
          }
          onKeyDown={
            handleKeyDown
          }
          placeholder={
            recording
              ? "Listening... Press Enter to send"
              : "Ask anything..."
          }
          rows="1"
          disabled={
            disabled
          }
        />


        <div className="composer-actions">

          <button
            type="button"
            className={`composer-button nova-icon-btn nova-mic-btn ${recording
              ? "recording nova-recording"
              : ""
              }`}
            onClick={
              toggleRecording
            }
            disabled={
              disabled
            }
            title={
              recording
                ? "Stop listening and send"
                : "Voice input"
            }
          >
            <span className="nova-mic-ring" aria-hidden="true" />
            <Mic size={18} />
          </button>


          <button
            type="button"
            className={`send-button nova-send-btn ${disabled
              ? "stop-button nova-stop"
              : hasContent
                ? "nova-active"
                : ""
              }`}
            onClick={
              disabled
                ? onStop
                : () => submitMessage()
            }
            disabled={
              !disabled &&
              !message.trim() &&
              attachments.length === 0
            }
            title={
              disabled
                ? "Stop generating"
                : "Send message"
            }
          >

            {disabled ? (
              <Square
                size={14}
                fill="currentColor"
              />
            ) : (
              <ArrowUp size={18} />
            )}

          </button>

        </div>

      </div>


      <div className="composer-disclaimer nova-disclaimer">
        Nova can make mistakes. Check
        important information.
      </div>

    </div>
  );
}


export default ChatComposer;