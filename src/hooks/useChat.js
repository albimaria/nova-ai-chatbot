import {
  useRef,
  useState,
} from "react";


import {
  uploadFile,
  streamMessage,
  editMessage as editMessageApi,
  regenerateMessage as regenerateMessageApi,
} from "../services/chatService";


export function useChat() {

  const [messages, setMessages] =
    useState([]);


  const [isLoading, setIsLoading] =
    useState(false);


  const [error, setError] =
    useState(null);


  const controllerRef =
    useRef(null);


  /*
   * SEND NEW MESSAGE
   *
   * Uses Gemini streaming.
   */

  const sendUserMessage = async (
    content,
    model = "Nova Standard",
    attachments = [],
    options = {}
  ) => {

    if (
      (!content.trim() &&
        attachments.length === 0) ||
      isLoading
    ) {
      return null;
    }


    setError(null);


    /*
     * CREATE USER MESSAGE
     */

    const userMessage = {
      id:
        `message-${Date.now()}`,

      role:
        "user",

      content:
        content.trim(),

      attachments:
        attachments || [],

      uploadedAttachments:
        [],

      createdAt:
        new Date().toISOString(),
    };


    /*
     * TEMPORARY ASSISTANT MESSAGE
     *
     * This is displayed immediately
     * and updated as Gemini sends
     * chunks.
     */

    const temporaryAssistantId =
      `assistant-stream-${Date.now()}`;


    const temporaryAssistantMessage = {
      id:
        temporaryAssistantId,

      role:
        "assistant",

      content:
        "",

      model,

      conversation_id:
        options.conversationId ||
        null,

      createdAt:
        new Date().toISOString(),

      isStreaming:
        true,
    };


    /*
     * SHOW USER + EMPTY ASSISTANT
     * IMMEDIATELY
     */

    setMessages(
      (previous) => [
        ...previous,

        userMessage,

        temporaryAssistantMessage,
      ]
    );


    setIsLoading(true);


    const controller =
      new AbortController();


    controllerRef.current =
      controller;


    try {

      /*
       * UPLOAD FILES FIRST
       */

      const uploadedAttachments = [];


      if (
        attachments &&
        attachments.length > 0
      ) {

        for (
          const attachment
          of attachments
        ) {

          const file =
            attachment.file;

          if (!file) {
            continue;
          }

          const uploaded =
            await uploadFile(
              file,
              controller.signal
            );

          uploadedAttachments.push(
            uploaded
          );
        }
      }

      const persistedUserMessage = {
        ...userMessage,
        uploadedAttachments,
      };

      setMessages(
        (previous) =>
          previous.map(
            (message) =>
              message.id === userMessage.id
                ? persistedUserMessage
                : message
          )
      );


      /*
       * START STREAMING
       */

      const assistantMessage =
        await streamMessage({

          message:
            content.trim(),

          model,

          history:
            options.history || [],

          conversationId:
            options.conversationId ||
            null,

          conversationTitle:
            options.conversationTitle ||
            "New conversation",

          messageId:
            userMessage.id,

          attachments:
            uploadedAttachments,

          signal:
            controller.signal,

          /*
           * THIS RUNS FOR EVERY
           * GEMINI CHUNK
           */

          onChunk:
            (
              chunk,
              fullContent
            ) => {

              setMessages(
                (previous) =>
                  previous.map(
                    (message) =>
                      message.id ===
                        temporaryAssistantId
                        ? {
                          ...message,

                          content:
                            fullContent,

                          isStreaming:
                            true,
                        }
                        : message
                  )
              );
            },
        });


      /*
       * STREAM FINISHED
       *
       * Replace temporary assistant
       * with the real database message.
       */

      const finalAssistantMessage =
      {
        ...assistantMessage,

        isStreaming:
          false,
      };


      setMessages(
        (previous) =>
          previous.map(
            (message) =>
              message.id ===
                temporaryAssistantId
                ? finalAssistantMessage
                : message
          )
      );


      return {
        userMessage:
          persistedUserMessage,

        assistantMessage:
          finalAssistantMessage,
      };


    } catch (err) {

      /*
       * USER PRESSED STOP
       */

      if (
        err.name ===
        "AbortError"
      ) {

        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                message.id ===
                  temporaryAssistantId
                  ? {
                    ...message,
                    isStreaming: false,
                  }
                  : message
            )
        );

        return {
          userMessage,

          assistantMessage: {
            id:
              temporaryAssistantId,

            role:
              "assistant",

            content:
              "",

            model,

            conversation_id:
              options.conversationId ||
              null,

            isStreaming:
              false,
          },

          aborted:
            true,
        };
      }


      console.error(
        "Streaming failed:",
        err
      );


      const errorMessage = {
        id:
          `error-${Date.now()}`,

        role:
          "error",

        content:
          err.message ||
          "Something went wrong. Please try again.",

        createdAt:
          new Date().toISOString(),
      };


      setError(
        errorMessage.content
      );


      /*
       * Remove temporary assistant
       * and show the error instead.
       */

      setMessages(
        (previous) => [
          ...previous.filter(
            (message) =>
              message.id !==
              temporaryAssistantId
          ),

          errorMessage,
        ]
      );


      return {
        userMessage,

        assistantMessage:
          errorMessage,
      };


    } finally {

      setIsLoading(false);

      controllerRef.current =
        null;
    }
  };


  /*
   * REGENERATE ASSISTANT RESPONSE
   *
   * Uses the normal regenerate
   * endpoint, not streaming yet.
   */

  const regenerateMessage = async (
    userMessage,
    model = "Nova Standard",
    options = {}
  ) => {

    if (isLoading) {
      return null;
    }


    setError(null);

    setIsLoading(true);


    const controller =
      new AbortController();


    controllerRef.current =
      controller;


    try {

      const result =
        await regenerateMessageApi({

          messageId:
            userMessage.id,

          model,

          history:
            options.history || [],

          attachments:
            options.attachments ||
            userMessage.uploadedAttachments ||
            userMessage.attachments ||
            [],
        });


      const assistantMessage =
        result.assistantMessage;


      setMessages(
        (previous) => {

          const updated = [
            ...previous,
          ];


          const userIndex =
            updated.findIndex(
              (message) =>
                message.id ===
                userMessage.id
            );


          if (
            userIndex === -1
          ) {
            return updated;
          }


          const assistantIndex =
            userIndex + 1;


          if (
            updated[
              assistantIndex
            ]?.role ===
            "assistant"
          ) {

            updated[
              assistantIndex
            ] = {

              ...updated[
              assistantIndex
              ],

              ...assistantMessage,
            };

          } else {

            updated.splice(
              assistantIndex,
              0,
              assistantMessage
            );
          }


          return updated;
        }
      );


      return {

        userMessage:
          result.userMessage,

        assistantMessage:
          result.assistantMessage,

        conversationId:
          result.conversation_id,
      };


    } catch (err) {

      if (
        err.name ===
        "AbortError"
      ) {
        return null;
      }


      console.error(
        "Regeneration failed:",
        err
      );


      setError(
        err.message ||
        "Failed to regenerate response."
      );


      return null;


    } finally {

      setIsLoading(false);

      controllerRef.current =
        null;
    }
  };


  /*
   * EDIT USER MESSAGE
   */

  const editMessage = async (
    message,
    newContent,
    model = "Nova Standard",
    options = {}
  ) => {

    if (
      isLoading ||
      !newContent.trim()
    ) {
      return null;
    }


    setError(null);

    setIsLoading(true);


    const controller =
      new AbortController();


    controllerRef.current =
      controller;


    try {

      const result =
        await editMessageApi({

          messageId:
            message.id,

          content:
            newContent.trim(),

          model,

          history:
            options.history || [],

          attachments:
            options.attachments ||
            message.uploadedAttachments ||
            message.attachments ||
            [],
        });


      const updatedUserMessage =
      {
        ...message,

        content:
          result.userMessage
            .content,

        updatedAt:
          new Date().toISOString(),
      };


      const assistantMessage =
        result.assistantMessage;


      setMessages(
        (previous) => {

          const userIndex =
            previous.findIndex(
              (item) =>
                item.id ===
                message.id
            );


          if (
            userIndex === -1
          ) {
            return previous;
          }


          const before =
            previous.slice(
              0,
              userIndex
            );


          return [
            ...before,

            updatedUserMessage,

            assistantMessage,
          ];
        }
      );


      return {

        userMessage:
          updatedUserMessage,

        assistantMessage,

        conversationId:
          result.conversation_id,
      };


    } catch (err) {

      if (
        err.name ===
        "AbortError"
      ) {
        return null;
      }


      console.error(
        "Edit failed:",
        err
      );


      setError(
        err.message ||
        "Failed to edit message."
      );


      return null;


    } finally {

      setIsLoading(false);

      controllerRef.current =
        null;
    }
  };


  /*
   * STOP GENERATION
   */

  const stopGeneration = () => {

    if (
      controllerRef.current
    ) {

      controllerRef.current.abort();

      controllerRef.current =
        null;
    }


    setIsLoading(false);
  };


  /*
   * LOAD CONVERSATION
   */

  const loadMessages = (
    conversationMessages
  ) => {

    setMessages(
      conversationMessages || []
    );

    setError(null);
  };


  /*
   * CLEAR CHAT
   */

  const clearChat = () => {

    if (
      controllerRef.current
    ) {

      controllerRef.current.abort();

      controllerRef.current =
        null;
    }


    setMessages([]);

    setError(null);

    setIsLoading(false);
  };


  return {

    messages,

    isLoading,

    error,

    sendUserMessage,

    regenerateMessage,

    editMessage,

    stopGeneration,

    loadMessages,

    clearChat,
  };
}