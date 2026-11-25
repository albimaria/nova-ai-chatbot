import { useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  ArrowUp,
  FileText,
  Globe,
  Image as ImageIcon,
  Mic,
  MicOff,
  Paperclip,
  Square,
  X,
} from "lucide-react";

import { uploadFile } from "../../api/client";
import { usePreferences } from "../../state/preferences";
import { useToast } from "../../state/toast";
import { Spinner } from "../ui/primitives";

const ACCEPT =
  ".pdf,.txt,.md,.csv,.json,.docx,.png,.jpg,.jpeg,.webp,.gif,.py,.js,.jsx,.ts,.tsx,.java,.c,.cpp,.html,.css,.sql";
const MAX_FILES = 10;
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_CHARS = 32000;

const SpeechRecognition =
  typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function Composer({ ref, onSend, onStop, streaming, disabled, webSearchAvailable, autoFocus }) {
  const { prefs, update } = usePreferences();
  const toast = useToast();

  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // { key, file, status, info, error }
  const [listening, setListening] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const controllersRef = useRef(new Map());

  const uploading = files.some((f) => f.status === "uploading");
  const ready = files.filter((f) => f.status === "done");
  const canSend = !disabled && !streaming && !uploading && (text.trim() || ready.length > 0);

  // Auto-grow the textarea.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      recognitionRef.current?.stop();
    };
  }, []);

  const addFiles = (incoming) => {
    const list = Array.from(incoming || []);
    if (!list.length) return;

    const room = MAX_FILES - files.length;
    if (list.length > room) toast.show(`You can attach up to ${MAX_FILES} files.`, "error");

    list.slice(0, Math.max(0, room)).forEach((file) => {
      if (file.size > MAX_BYTES) {
        toast.show(`${file.name} is larger than 50 MB.`, "error");
        return;
      }

      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`;
      const controller = new AbortController();
      controllersRef.current.set(key, controller);

      setFiles((current) => [...current, { key, file, status: "uploading" }]);

      uploadFile(file, controller.signal)
        .then((info) => {
          setFiles((current) => current.map((f) => (f.key === key ? { ...f, status: "done", info } : f)));
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          toast.show(error.message, "error", 5000);
          setFiles((current) => current.filter((f) => f.key !== key));
        })
        .finally(() => controllersRef.current.delete(key));
    });
  };

  useImperativeHandle(ref, () => ({
    addFiles,
    setText: (value) => {
      setText(value);
      textareaRef.current?.focus();
    },
    focus: () => textareaRef.current?.focus(),
  }));

  const removeFile = (key) => {
    controllersRef.current.get(key)?.abort();
    setFiles((current) => current.filter((f) => f.key !== key));
  };

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), ready.map((f) => f.info));
    setText("");
    setFiles([]);
    recognitionRef.current?.stop();
  };

  const toggleVoice = () => {
    if (!SpeechRecognition) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    const base = text ? `${text.trimEnd()} ` : "";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setText(base + transcript);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") toast.show("Microphone access was blocked.", "error");
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <div
      className="composer-wrap"
      onDragOver={(event) => {
        if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!event.dataTransfer?.files?.length) return;
        event.preventDefault();
        addFiles(event.dataTransfer.files);
      }}
    >
      <form
        className={`composer glass ${streaming ? "is-streaming" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {files.length > 0 && (
          <ul className="composer-files" aria-label="Attached files">
            {files.map(({ key, file, status }) => {
              const Icon = file.type.startsWith("image/") ? ImageIcon : FileText;
              return (
                <li key={key} className={`file-pill ${status}`}>
                  {status === "uploading" ? <Spinner size={14} /> : <Icon size={14} aria-hidden="true" />}
                  <span className="file-pill-name">{file.name}</span>
                  <button type="button" onClick={() => removeFile(key)} aria-label={`Remove ${file.name}`}>
                    <X size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <label htmlFor="composer-input" className="sr-only">
          Message Nova
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          rows={1}
          value={text}
          maxLength={MAX_CHARS}
          placeholder={listening ? "Listening…" : "Message Nova…"}
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => {
            const pasted = Array.from(event.clipboardData?.files || []);
            if (pasted.length) {
              event.preventDefault();
              addFiles(pasted);
            }
          }}
          onKeyDown={(event) => {
            const sendKey = prefs.enterToSend
              ? event.key === "Enter" && !event.shiftKey
              : event.key === "Enter" && (event.ctrlKey || event.metaKey);

            if (sendKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />

        <div className="composer-bar">
          <div className="composer-tools">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="tool-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach files"
              title="Attach files (PDF, images, Word, text, code)"
              disabled={disabled}
            >
              <Paperclip size={18} />
            </button>

            {webSearchAvailable && (
              <button
                type="button"
                className={`tool-btn tool-pill ${prefs.webSearch ? "active" : ""}`}
                onClick={() => update({ webSearch: !prefs.webSearch })}
                aria-pressed={prefs.webSearch}
                title="Search the web for up-to-date answers"
              >
                <Globe size={16} />
                <span>Search</span>
              </button>
            )}

            {SpeechRecognition && (
              <button
                type="button"
                className={`tool-btn ${listening ? "active recording" : ""}`}
                onClick={toggleVoice}
                aria-pressed={listening}
                aria-label={listening ? "Stop dictation" : "Dictate with your voice"}
                title={listening ? "Stop dictation" : "Dictate"}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
          </div>

          {streaming ? (
            <button type="button" className="send-btn stop" onClick={onStop} aria-label="Stop generating" title="Stop (Esc)">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              className="send-btn"
              disabled={!canSend}
              aria-label={uploading ? "Waiting for uploads" : "Send message"}
              title={uploading ? "Waiting for uploads to finish" : "Send"}
            >
              {uploading ? <Spinner size={16} /> : <ArrowUp size={19} strokeWidth={2.5} />}
            </button>
          )}
        </div>
      </form>

      <p className="composer-hint">
        Nova can make mistakes. Check important information.
        {text.length > MAX_CHARS * 0.9 && (
          <span className="char-count">
            {" "}
            {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        )}
      </p>
    </div>
  );
}
