import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { API_BASE_URL, authApi, setUnauthorizedHandler, tokenStore } from "./api/client";
import AuthScreen from "./components/auth/AuthScreen";
import ChatApp from "./components/layout/ChatApp";
import SharedView from "./components/share/SharedView";
import { SceneBoundary, Spinner } from "./components/ui/primitives";
import { usePreferences } from "./state/preferences";
import { useToast } from "./state/toast";

const NovaScene = lazy(() => import("./components/three/NovaScene"));

const isDemoLink = () => window.location.hash.startsWith("#/demo");

function readShareToken() {
  const match = window.location.hash.match(/^#\/share\/([\w-]+)/);
  return match ? match[1] : null;
}

/** Mount the 3D scene once the browser is idle so chats load first. */
function useIdleReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setReady(true), 300);
    return () => window.clearTimeout(id);
  }, []);

  return ready;
}

/** Render's free tier sleeps; tell the user while it wakes up. */
function useServerWake() {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    let done = false;
    const timer = window.setTimeout(() => !done && setWaking(true), 2500);

    fetch(`${API_BASE_URL}/health`)
      .catch(() => {})
      .finally(() => {
        done = true;
        window.clearTimeout(timer);
        setWaking(false);
      });

    return () => window.clearTimeout(timer);
  }, []);

  return waking;
}

export default function App() {
  const { prefs, resolvedTheme } = usePreferences();
  const toast = useToast();
  const waking = useServerWake();
  const sceneReady = useIdleReady();

  const [shareToken, setShareToken] = useState(readShareToken);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(tokenStore.get()));
  const [scene, setScene] = useState({ mode: "auth", busy: false, offsetPx: 0 });

  useEffect(() => {
    const onHash = () => setShareToken(readShareToken());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setScene({ mode: "auth", busy: false, offsetPx: 0 });
    window.history.replaceState(null, "", "#/");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      toast.show("Your session ended. Please log in again.", "info");
    });
  }, [logout, toast]);

  // Portfolio "live demo" links (#/demo) sign visitors straight into a guest account.
  const [startingDemo, setStartingDemo] = useState(() => isDemoLink() && !tokenStore.get());

  useEffect(() => {
    if (!isDemoLink()) return;

    if (tokenStore.get()) {
      window.history.replaceState(null, "", "#/");
      return;
    }

    authApi
      .guest()
      .then((data) => {
        tokenStore.set(data.access_token);
        setUser({ user_id: data.user_id, email: data.email, name: data.name, is_guest: true });
      })
      .catch((error) => toast.show(error.message, "error", 6000))
      .finally(() => {
        window.history.replaceState(null, "", "#/");
        setStartingDemo(false);
      });
  }, [toast]);

  // Restore the session on load.
  useEffect(() => {
    if (!tokenStore.get()) return;

    authApi
      .me()
      .then(setUser)
      .catch((error) => {
        if (error.status === 401) tokenStore.clear();
        else toast.show(error.message, "error", 6000);
      })
      .finally(() => setChecking(false));
  }, [toast]);

  const onSceneChange = useCallback((next) => {
    setScene((current) =>
      current.mode === next.mode && current.busy === next.busy && current.offsetPx === next.offsetPx
        ? current
        : next
    );
  }, []);

  let content;
  let sceneState = scene;

  if (shareToken) {
    content = <SharedView token={shareToken} />;
    sceneState = { mode: "chat", busy: false, offsetPx: 0 };
  } else if (checking || startingDemo) {
    content = (
      <div className="center-fill full">
        <Spinner size={30} />
      </div>
    );
  } else if (!user) {
    content = (
      <AuthScreen
        onAuthenticated={(data) => {
          setUser(data);
          // Fetch the full profile (custom instructions etc.).
          authApi.me().then(setUser).catch(() => {});
        }}
      />
    );
    sceneState = { mode: "auth", busy: false, offsetPx: 0 };
  } else {
    content = (
      <ChatApp
        user={user}
        onUserChange={setUser}
        onLogout={logout}
        onSceneChange={onSceneChange}
      />
    );
  }

  return (
    <>
      <div className="backdrop" aria-hidden="true" />

      {sceneReady && (
        <SceneBoundary>
          <Suspense fallback={null}>
            <NovaScene
              mode={sceneState.mode}
              busy={sceneState.busy}
              offsetPx={sceneState.offsetPx}
              theme={resolvedTheme}
              motion={prefs.motion}
            />
          </Suspense>
        </SceneBoundary>
      )}

      <div className="app-layer">{content}</div>

      {waking && (
        <div className="wake-banner glass" role="status">
          <Spinner size={14} /> Waking up Nova's server… this can take up to a minute.
        </div>
      )}
    </>
  );
}
