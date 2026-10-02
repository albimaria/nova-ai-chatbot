const API_BASE_URL =
  "https://nova-ai-chatbot-1gwj.onrender.com";

const AUTH_TOKEN_KEY =
  "nova_access_token";


// ============================================================
// AUTHENTICATION HELPERS
// ============================================================

export function getAuthToken() {
  return localStorage.getItem(
    AUTH_TOKEN_KEY
  );
}


export function setAuthToken(
  token
) {
  localStorage.setItem(
    AUTH_TOKEN_KEY,
    token
  );
}


export function removeAuthToken() {
  localStorage.removeItem(
    AUTH_TOKEN_KEY
  );
}


function getAuthHeaders(
  headers = {}
) {
  const token =
    getAuthToken();

  if (!token) {
    return {
      ...headers,
    };
  }

  return {
    ...headers,

    Authorization:
      `Bearer ${token}`,
  };
}


// ============================================================
// UPLOAD FILE
// ============================================================

export async function uploadFile(
  file,
  signal
) {
  if (!file) {
    throw new Error(
      "No file selected."
    );
  }

  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  const response =
    await fetch(
      `${API_BASE_URL}/files/upload`,
      {
        method: "POST",

        headers:
          getAuthHeaders(),

        body: formData,

        signal,
      }
    );

  if (!response.ok) {
    let errorMessage =
      "Failed to upload file.";

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          typeof errorData.detail ===
            "string"
            ? errorData.detail
            : JSON.stringify(
              errorData.detail
            );
      }
    } catch {
      // Keep default error message.
    }

    const error =
      new Error(
        errorMessage
      );

    error.status =
      response.status;

    throw error;
  }

  const data =
    await response.json();

  return {
    name:
      data.name,

    displayName:
      data.displayName,

    mimeType:
      data.mimeType,

    uri:
      data.uri,

    fileSize:
      data.fileSize,
  };
}


// ============================================================
// NORMAL CHAT
// ============================================================

export async function sendMessage({
  message,
  model = "Nova Standard",
  history = [],
  conversationId = null,
  conversationTitle = "New conversation",
  messageId = null,
  attachments = [],
  signal,
}) {
  const response =
    await fetch(
      `${API_BASE_URL}/chat`,
      {
        method: "POST",

        headers:
          getAuthHeaders({
            "Content-Type":
              "application/json",
          }),

        body: JSON.stringify({
          message,

          model,

          history,

          conversation_id:
            conversationId,

          conversation_title:
            conversationTitle,

          message_id:
            messageId,

          attachments,
        }),

        signal,
      }
    );

  if (!response.ok) {
    let errorMessage =
      "Failed to get response from Nova.";

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          typeof errorData.detail ===
            "string"
            ? errorData.detail
            : JSON.stringify(
              errorData.detail
            );
      }
    } catch {
      // Keep default error message.
    }

    const error =
      new Error(
        errorMessage
      );

    error.status =
      response.status;

    throw error;
  }

  const data =
    await response.json();

  return {
    id:
      data.id,

    role:
      data.role,

    content:
      data.content,

    model:
      data.model,

    conversation_id:
      data.conversation_id ||
      conversationId,

    createdAt:
      new Date().toISOString(),
  };
}


// ============================================================
// STREAMING CHAT
// ============================================================

export async function streamMessage({
  message,
  model = "Nova Standard",
  history = [],
  conversationId = null,
  conversationTitle = "New conversation",
  messageId = null,
  attachments = [],
  signal,
  onChunk,
}) {
  const response =
    await fetch(
      `${API_BASE_URL}/chat/stream`,
      {
        method: "POST",

        headers:
          getAuthHeaders({
            "Content-Type":
              "application/json",

            "Accept":
              "text/event-stream",
          }),

        body: JSON.stringify({
          message,

          model,

          history,

          conversation_id:
            conversationId,

          conversation_title:
            conversationTitle,

          message_id:
            messageId,

          attachments,
        }),

        signal,
      }
    );

  if (!response.ok) {
    let errorMessage =
      "Failed to stream response from Nova.";

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          typeof errorData.detail ===
            "string"
            ? errorData.detail
            : JSON.stringify(
              errorData.detail
            );
      }
    } catch {
      // Keep default error message.
    }

    const error =
      new Error(
        errorMessage
      );

    error.status =
      response.status;

    throw error;
  }

  if (!response.body) {
    throw new Error(
      "Streaming is not supported by this browser."
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder(
      "utf-8"
    );

  let buffer = "";

  let fullContent = "";

  let assistantId = null;

  let backendConversationId =
    conversationId;

  try {
    while (true) {
      const {
        value,
        done,
      } = await reader.read();

      if (done) {
        break;
      }

      buffer +=
        decoder.decode(
          value,
          {
            stream: true,
          }
        );

      const events =
        buffer.split(
          "\n\n"
        );

      buffer =
        events.pop() || "";

      for (
        const event
        of events
      ) {
        const lines =
          event.split(
            "\n"
          );

        let eventType =
          "message";

        let eventData =
          "";

        for (
          const line
          of lines
        ) {
          if (
            line.startsWith(
              "event:"
            )
          ) {
            eventType =
              line
                .slice(6)
                .trim();
          }

          if (
            line.startsWith(
              "data:"
            )
          ) {
            eventData +=
              line.slice(5);
          }
        }

        /*
         * Ignore empty events.
         */

        if (
          !eventData
        ) {
          continue;
        }

        /*
         * ERROR EVENT
         */

        if (
          eventType ===
          "error"
        ) {
          throw new Error(
            eventData.trim() ||
            "Failed to generate response."
          );
        }

        /*
         * DONE EVENT
         *
         * Format:
         *
         * assistantId|conversationId
         */

        if (
          eventType ===
          "done"
        ) {
          const parts =
            eventData
              .trim()
              .split("|");

          assistantId =
            parts[0] ||
            null;

          backendConversationId =
            parts[1] ||
            backendConversationId;

          continue;
        }

        /*
         * NORMAL CONTENT CHUNK
         */

        const chunk =
          eventData
            .replace(
              /\\n/g,
              "\n"
            );

        fullContent +=
          chunk;

        if (
          onChunk
        ) {
          onChunk(
            chunk,
            fullContent
          );
        }
      }
    }

    /*
     * Process any remaining
     * buffered event.
     */

    if (
      buffer.trim()
    ) {
      const lines =
        buffer.split(
          "\n"
        );

      let eventType =
        "message";

      let eventData =
        "";

      for (
        const line
        of lines
      ) {
        if (
          line.startsWith(
            "event:"
          )
        ) {
          eventType =
            line
              .slice(6)
              .trim();
        }

        if (
          line.startsWith(
            "data:"
          )
        ) {
          eventData +=
            line.slice(5);
        }
      }

      if (
        eventType ===
        "done"
      ) {
        const parts =
          eventData
            .trim()
            .split("|");

        assistantId =
          parts[0] ||
          assistantId;

        backendConversationId =
          parts[1] ||
          backendConversationId;
      }
    }

    /*
     * Return the complete
     * assistant message.
     */

    return {
      id:
        assistantId ||
        `assistant-${Date.now()}`,

      role:
        "assistant",

      content:
        fullContent,

      model,

      conversation_id:
        backendConversationId,

      createdAt:
        new Date().toISOString(),
    };

  } finally {
    reader.releaseLock();
  }
}


// ============================================================
// GET ALL CONVERSATIONS
// ============================================================

export async function getConversations() {
  const response =
    await fetch(
      `${API_BASE_URL}/conversations`,
      {
        headers:
          getAuthHeaders(),
      }
    );

  if (!response.ok) {
    const error =
      new Error(
        "Failed to load conversations."
      );

    error.status =
      response.status;

    throw error;
  }

  return await response.json();
}


// ============================================================
// GET ONE CONVERSATION
// ============================================================

export async function getConversation(
  conversationId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/conversations/${conversationId}`,
      {
        headers:
          getAuthHeaders(),
      }
    );

  if (!response.ok) {
    const error =
      new Error(
        "Failed to load conversation."
      );

    error.status =
      response.status;

    throw error;
  }

  return await response.json();
}


// ============================================================
// DELETE CONVERSATION
// ============================================================

export async function deleteConversation(
  conversationId
) {
  const response =
    await fetch(
      `${API_BASE_URL}/conversations/${conversationId}`,
      {
        method: "DELETE",

        headers:
          getAuthHeaders(),
      }
    );

  if (!response.ok) {
    const error =
      new Error(
        "Failed to delete conversation."
      );

    error.status =
      response.status;

    throw error;
  }

  return await response.json();
}


// ============================================================
// RENAME CONVERSATION
// ============================================================

export async function renameConversation(
  conversationId,
  title
) {
  const response =
    await fetch(
      `${API_BASE_URL}/conversations/${conversationId}`,
      {
        method: "PUT",

        headers:
          getAuthHeaders({
            "Content-Type":
              "application/json",
          }),

        body: JSON.stringify({
          title,
        }),
      }
    );

  if (!response.ok) {
    let errorMessage =
      "Failed to rename conversation.";

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          typeof errorData.detail ===
            "string"
            ? errorData.detail
            : JSON.stringify(
              errorData.detail
            );
      }
    } catch {
      // Keep default error message.
    }

    const error =
      new Error(
        errorMessage
      );

    error.status =
      response.status;

    throw error;
  }

  return await response.json();
}


// ============================================================
// EDIT MESSAGE
// ============================================================

export async function editMessage(
  {
    messageId,
    content,
    model = "Nova Standard",
    history = [],
    attachments = [],
  }
) {
  const response =
    await fetch(
      `${API_BASE_URL}/chat/message/edit`,
      {
        method: "PUT",

        headers:
          getAuthHeaders({
            "Content-Type":
              "application/json",
          }),

        body: JSON.stringify({
          message_id:
            messageId,

          content,

          model,

          history,

          attachments,
        }),
      }
    );

  if (!response.ok) {
    let errorMessage =
      "Failed to edit message.";

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          typeof errorData.detail ===
            "string"
            ? errorData.detail
            : JSON.stringify(
              errorData.detail
            );
      }
    } catch {
      // Keep default error message.
    }

    const error =
      new Error(
        errorMessage
      );

    error.status =
      response.status;

    throw error;
  }

  return await response.json();
}


// ============================================================
// REGENERATE MESSAGE
// ============================================================

export async function regenerateMessage(
  {
    messageId,
    model = "Nova Standard",
    history = [],
    attachments = [],
  }
) {
  const response =
    await fetch(
      `${API_BASE_URL}/chat/message/regenerate`,
      {
        method: "POST",

        headers:
          getAuthHeaders({
            "Content-Type":
              "application/json",
          }),

        body: JSON.stringify({
          message_id:
            messageId,

          model,

          history,

          attachments,
        }),
      }
    );

  if (!response.ok) {
    let errorMessage =
      "Failed to regenerate message.";

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          typeof errorData.detail ===
            "string"
            ? errorData.detail
            : JSON.stringify(
              errorData.detail
            );
      }
    } catch {
      // Keep default error message.
    }

    const error =
      new Error(
        errorMessage
      );

    error.status =
      response.status;

    throw error;
  }

  return await response.json();
}