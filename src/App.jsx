import {
  useEffect,
  useState,
} from "react";

import Toast from "./components/common/Toast";
import Sidebar from "./components/layout/Sidebar";
import ChatLayout from "./components/layout/ChatLayout";
import SettingsModal from "./components/common/SettingsModal";
import AuthPage from "./components/auth/AuthPage";

import {
  getConversations,
  deleteConversation,
  renameConversation,
  getAuthToken,
  removeAuthToken,
} from "./services/chatService";


function App() {

  /*
   * AUTHENTICATION
   */

  const [
    isAuthenticated,
    setIsAuthenticated,
  ] = useState(() => {
    return Boolean(
      getAuthToken()
    );
  });


  /*
   * SIDEBAR
   */

  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(false);


  /*
   * CONVERSATIONS
   */

  const [
    conversations,
    setConversations,
  ] = useState([]);


  /*
   * ACTIVE CONVERSATION
   */

  const [
    activeConversation,
    setActiveConversation,
  ] = useState(() => {
    return localStorage.getItem(
      "nova-active-conversation"
    );
  });


  /*
   * SETTINGS
   */

  const [
    settingsOpen,
    setSettingsOpen,
  ] = useState(false);


  /*
   * THEME
   */

  const [
    theme,
    setTheme,
  ] = useState(() => {
    return (
      localStorage.getItem(
        "nova-theme"
      ) || "soft"
    );
  });


  /*
   * TOAST
   */

  const [
    toast,
    setToast,
  ] = useState({
    visible: false,
    message: "",
  });


  /*
   * SHOW TOAST
   */

  const showToast = (
    message
  ) => {

    setToast({
      visible: true,
      message,
    });


    setTimeout(() => {

      setToast({
        visible: false,
        message: "",
      });

    }, 2200);
  };


  /*
   * LOGOUT
   *
   * Declared before the conversation
   * loading effect so it can be safely
   * called from that effect.
   */

  const handleLogout =
    () => {

      removeAuthToken();

      localStorage.removeItem(
        "nova_user"
      );

      localStorage.removeItem(
        "nova-active-conversation"
      );

      setConversations(
        []
      );

      setActiveConversation(
        null
      );

      setSettingsOpen(
        false
      );

      setIsAuthenticated(
        false
      );
    };


  /*
   * LOAD CONVERSATIONS
   * ONLY AFTER LOGIN
   */

  useEffect(() => {

    if (!isAuthenticated) {
      return;
    }


    const loadBackendConversations =
      async () => {

        try {

          const data =
            await getConversations();


          const normalized =
            data.map(
              (conversation) => ({
                ...conversation,

                messages:
                  [],
              })
            );


          setConversations(
            normalized
          );


          /*
           * Restore previously
           * selected conversation
           * only if it still exists.
           */

          const savedActive =
            localStorage.getItem(
              "nova-active-conversation"
            );


          if (
            savedActive &&
            normalized.some(
              (conversation) =>
                conversation.id ===
                savedActive
            )
          ) {

            setActiveConversation(
              savedActive
            );

          } else {

            setActiveConversation(
              null
            );

            localStorage.removeItem(
              "nova-active-conversation"
            );
          }

        } catch (error) {

          console.error(
            "Failed to load conversations:",
            error
          );


          /*
           * If authentication has
           * expired or is invalid,
           * return to login.
           */

          if (
            error?.response?.status === 401 ||
            error?.status === 401 ||
            error?.message?.includes("401")
          ) {

            handleLogout();

            return;
          }


          showToast(
            "Could not load conversations"
          );
        }
      };


    loadBackendConversations();

  }, [
    isAuthenticated,
  ]);


  /*
   * SAVE THEME
   */

  useEffect(() => {

    localStorage.setItem(
      "nova-theme",
      theme
    );

  }, [
    theme,
  ]);


  /*
   * SAVE ACTIVE CONVERSATION
   */

  useEffect(() => {

    if (activeConversation) {

      localStorage.setItem(
        "nova-active-conversation",
        activeConversation
      );

    } else {

      localStorage.removeItem(
        "nova-active-conversation"
      );
    }

  }, [
    activeConversation,
  ]);


  /*
   * LOGIN / SIGNUP SUCCESS
   */

  const handleAuthenticated =
    () => {

      setIsAuthenticated(
        true
      );

      setConversations(
        []
      );

      setActiveConversation(
        null
      );
    };


  /*
   * NEW CHAT
   */

  const handleNewChat =
    () => {

      setActiveConversation(
        null
      );
    };


  /*
   * SELECT CONVERSATION
   */

  const handleSelectConversation =
    (id) => {

      setActiveConversation(
        id
      );


      if (
        window.innerWidth <=
        768
      ) {

        setSidebarCollapsed(
          true
        );
      }
    };


  /*
   * DELETE CONVERSATION
   */

  const handleDeleteConversation =
    async (id) => {

      try {

        await deleteConversation(
          id
        );


        setConversations(
          (previous) =>
            previous.filter(
              (conversation) =>
                conversation.id !==
                id
            )
        );


        if (
          activeConversation ===
          id
        ) {

          setActiveConversation(
            null
          );
        }


        showToast(
          "Conversation deleted"
        );

      } catch (error) {

        console.error(
          "Failed to delete conversation:",
          error
        );


        showToast(
          "Could not delete conversation"
        );
      }
    };


  /*
   * RENAME CONVERSATION
   */

  const handleRenameConversation =
    async (
      id,
      title
    ) => {

      try {

        const updatedConversation =
          await renameConversation(
            id,
            title
          );


        setConversations(
          (previous) =>
            previous.map(
              (conversation) =>
                conversation.id ===
                  id
                  ? {
                    ...conversation,

                    title:
                      updatedConversation.title,

                    updatedAt:
                      updatedConversation.updatedAt,
                  }
                  : conversation
            )
        );


        showToast(
          "Conversation renamed"
        );

      } catch (error) {

        console.error(
          "Failed to rename conversation:",
          error
        );


        showToast(
          "Could not rename conversation"
        );
      }
    };


  /*
   * UPDATE CONVERSATION
   */

  const handleConversationUpdate =
    (
      conversation
    ) => {

      setConversations(
        (previous) => {

          const exists =
            previous.some(
              (item) =>
                item.id ===
                conversation.id
            );


          if (exists) {

            return previous.map(
              (item) =>
                item.id ===
                  conversation.id
                  ? {
                    ...item,
                    ...conversation,
                  }
                  : item
            );
          }


          return [
            conversation,
            ...previous,
          ];
        }
      );


      setActiveConversation(
        conversation.id
      );
    };


  /*
   * SHOW LOGIN / SIGNUP
   * WHEN NOT AUTHENTICATED
   */

  if (!isAuthenticated) {

    return (
      <AuthPage
        onAuthenticated={
          handleAuthenticated
        }
      />
    );
  }


  /*
   * MAIN NOVA APPLICATION
   */

  return (
    <div
      className={`app theme-${theme}`}
    >

      <Sidebar
        collapsed={
          sidebarCollapsed
        }

        setCollapsed={
          setSidebarCollapsed
        }

        conversations={
          conversations
        }

        activeConversation={
          activeConversation
        }

        onNewChat={
          handleNewChat
        }

        onSelectConversation={
          handleSelectConversation
        }

        onDeleteConversation={
          handleDeleteConversation
        }

        onRenameConversation={
          handleRenameConversation
        }

        onOpenSettings={() =>
          setSettingsOpen(
            true
          )
        }

        onLogout={
          handleLogout
        }
      />


      <ChatLayout
        sidebarCollapsed={
          sidebarCollapsed
        }

        activeConversation={
          activeConversation
        }

        conversations={
          conversations
        }

        onConversationUpdate={
          handleConversationUpdate
        }
      />


      <SettingsModal
        open={
          settingsOpen
        }

        onClose={() =>
          setSettingsOpen(
            false
          )
        }

        theme={
          theme
        }

        onThemeChange={(
          newTheme
        ) => {

          setTheme(
            newTheme
          );


          showToast(
            newTheme ===
              "soft"
              ? "Soft theme applied"
              : "Lavender theme applied"
          );
        }}
      />


      <Toast
        visible={
          toast.visible
        }

        message={
          toast.message
        }

        onClose={() =>
          setToast({
            visible: false,
            message: "",
          })
        }
      />

    </div>
  );
}


export default App;