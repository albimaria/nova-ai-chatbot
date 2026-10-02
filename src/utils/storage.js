const STORAGE_KEY = "nova-chatbot-conversations";

export function loadConversations() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    return JSON.parse(stored);
  } catch (error) {
    console.error(
      "Failed to load conversations:",
      error
    );

    return [];
  }
}

export function saveConversations(conversations) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations)
    );
  } catch (error) {
    console.error(
      "Failed to save conversations:",
      error
    );
  }
}

export function deleteConversation(id) {
  const conversations = loadConversations();

  const updated = conversations.filter(
    (conversation) => conversation.id !== id
  );

  saveConversations(updated);

  return updated;
}

export function clearConversations() {
  localStorage.removeItem(STORAGE_KEY);
}