import { useCallback, useEffect, useRef, useState } from "react";

import { chatApi, conversationsApi, streamChat } from "../api/client";

const tempId = (prefix) => `tmp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const isTemp = (id) => !id || String(id).startsWith("tmp-");

const EMPTY = [];

/**
 * Messages + streaming for one conversation.
 *
 * callbacks:
 *  onConversationStarted(id)   new chat got its server id
 *  onConversationTouched(id, { title })  a reply finished (move chat to top, set title)
 *  onNotice(message)            non-fatal info (e.g. web search unavailable)
 */
export function useChat(conversationId, options, callbacks) {
  // Messages are tagged with the conversation they belong to; what is shown is derived.
  // `undefined` = nothing loaded yet (null is the unsaved "new chat").
  const [store, setStore] = useState({ id: undefined, messages: [] });
  const [loadError, setLoadError] = useState(null); // { id, message }
  const [streaming, setStreaming] = useState(false);

  const controllerRef = useRef(null);
  const callbacksRef = useRef(callbacks);
  const optionsRef = useRef(options);

  useEffect(() => {
    callbacksRef.current = callbacks;
    optionsRef.current = options;
  });

  const owned = store.id === (conversationId ?? null);
  const messages = owned ? store.messages : EMPTY;
  const loading = Boolean(conversationId) && !owned && loadError?.id !== conversationId;

  const setMessages = useCallback(
    (update) => setStore((current) => ({ ...current, messages: update(current.messages) })),
    []
  );

  // ---------------- Load conversation ----------------
  useEffect(() => {
    // Already have it (e.g. we just created it while streaming): keep the stream running.
    if (store.id === (conversationId ?? null)) return undefined;

    // Switching to a different chat stops any reply in progress.
    controllerRef.current?.abort();

    if (!conversationId) return undefined;

    let cancelled = false;

    conversationsApi
      .get(conversationId)
      .then((data) => {
        if (!cancelled) setStore({ id: conversationId, messages: data.messages || [] });
      })
      .catch((error) => {
        if (!cancelled) setLoadError({ id: conversationId, message: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, store.id]);

  // Abort any stream on unmount (e.g. logout).
  useEffect(() => () => controllerRef.current?.abort(), []);

  const patch = useCallback(
    (id, fields) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === id
            ? { ...message, ...(typeof fields === "function" ? fields(message) : fields) }
            : message
        )
      );
    },
    [setMessages]
  );

  // ---------------- Core streaming runner ----------------
  const run = useCallback(
    async ({ kind, messageId, body, userTempId, assistantTempId }) => {
      const controller = new AbortController();
      controllerRef.current = controller;
      setStreaming(true);

      let assistantId = assistantTempId;
      let buffer = "";
      let frame = null;

      // Batch token updates to one render per animation frame.
      const flush = () => {
        frame = null;
        if (!buffer) return;
        const chunk = buffer;
        buffer = "";
        patch(assistantId, (message) => ({ content: message.content + chunk }));
      };

      try {
        await streamChat({
          kind,
          messageId,
          signal: controller.signal,
          body: {
            model: optionsRef.current.model,
            temperature: optionsRef.current.temperature,
            web_search: optionsRef.current.webSearch,
            ...body,
          },
          handlers: {
            onStart: (data) => {
              if (userTempId) patch(userTempId, { id: data.userMessageId });
              patch(assistantTempId, { id: data.assistantMessageId, model: data.model });
              assistantId = data.assistantMessageId;

              if (!conversationId && data.conversationId) {
                // Claim the messages for the new chat in the same render as the parent switches to it.
                setStore((current) => ({ ...current, id: data.conversationId }));
                callbacksRef.current.onConversationStarted?.(data.conversationId);
              }
            },
            onDelta: (text) => {
              buffer += text;
              if (!frame) frame = requestAnimationFrame(flush);
            },
            onSources: (sources) => patch(assistantId, { sources }),
            onNotice: (message) => callbacksRef.current.onNotice?.(message),
            onDone: (data) => {
              callbacksRef.current.onConversationTouched?.(data.conversationId, {
                title: data.title,
              });
            },
          },
        });

        if (frame) cancelAnimationFrame(frame);
        flush();
        patch(assistantId, { streaming: false });
      } catch (error) {
        if (frame) cancelAnimationFrame(frame);
        flush();

        if (error.name === "AbortError") {
          // Stopped by the user: keep the partial answer (the server saves it too).
          setMessages((current) =>
            current
              .map((m) => (m.id === assistantId ? { ...m, streaming: false, stopped: true } : m))
              .filter((m) => !(m.id === assistantId && !m.content))
          );
        } else {
          patch(assistantId, { streaming: false, error: error.message });
        }
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
        setStreaming(false);
      }
    },
    [conversationId, patch, setMessages]
  );

  const assistantPlaceholder = (id) => ({
    id,
    role: "assistant",
    content: "",
    model: optionsRef.current.model,
    streaming: true,
    sources: [],
    attachments: [],
    createdAt: new Date().toISOString(),
  });

  // ---------------- Actions ----------------
  const send = useCallback(
    (text, attachments = []) => {
      if (controllerRef.current) return;

      const userTempId = tempId("user");
      const assistantTempId = tempId("assistant");

      const ownerId = conversationId ?? null;

      setStore((current) => ({
        id: ownerId,
        messages: [
          ...(current.id === ownerId ? current.messages : []),
          {
          id: userTempId,
          role: "user",
          content: text,
          attachments,
          createdAt: new Date().toISOString(),
          },
          assistantPlaceholder(assistantTempId),
        ],
      }));

      return run({
        kind: "send",
        body: { message: text, conversation_id: conversationId, attachments },
        userTempId,
        assistantTempId,
      });
    },
    [conversationId, run]
  );

  const edit = useCallback(
    (messageId, text) => {
      if (controllerRef.current || isTemp(messageId)) return;
      const assistantTempId = tempId("assistant");

      setMessages((current) => {
        const index = current.findIndex((m) => m.id === messageId);
        if (index === -1) return current;
        return [
          ...current.slice(0, index),
          { ...current[index], content: text },
          assistantPlaceholder(assistantTempId),
        ];
      });

      return run({ kind: "edit", messageId, body: { content: text }, assistantTempId });
    },
    [run, setMessages]
  );

  /** Regenerate from an assistant reply, or retry a user message that got no answer. */
  const regenerate = useCallback(
    (messageId) => {
      if (controllerRef.current || isTemp(messageId)) return;
      const assistantTempId = tempId("assistant");

      setMessages((current) => {
        const index = current.findIndex((m) => m.id === messageId);
        if (index === -1) return current;
        const keep = current[index].role === "user" ? index + 1 : index;
        return [...current.slice(0, keep), assistantPlaceholder(assistantTempId)];
      });

      return run({ kind: "regenerate", messageId, body: {}, assistantTempId });
    },
    [run, setMessages]
  );

  /** Retry after an error on a reply that never got a server id. */
  const retry = useCallback(
    (failedAssistantId) => {
      const index = messages.findIndex((m) => m.id === failedAssistantId);
      const previousUser = messages
        .slice(0, index)
        .reverse()
        .find((m) => m.role === "user");

      if (previousUser && !isTemp(previousUser.id)) {
        regenerate(previousUser.id);
      } else if (previousUser) {
        // The message never reached the server: send it again.
        setMessages((current) => current.slice(0, current.indexOf(previousUser)));
        send(previousUser.content, previousUser.attachments);
      }
    },
    [messages, regenerate, send, setMessages]
  );

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  const setFeedback = useCallback(
    async (messageId, value) => {
      const previous = messages.find((m) => m.id === messageId)?.feedback ?? null;
      patch(messageId, { feedback: value });

      try {
        await chatApi.feedback(messageId, value);
      } catch (error) {
        patch(messageId, { feedback: previous });
        throw error;
      }
    },
    [messages, patch]
  );

  return {
    messages,
    loading,
    loadError: loadError?.id === conversationId ? loadError.message : null,
    streaming,
    send,
    edit,
    regenerate,
    retry,
    stop,
    setFeedback,
  };
}
