import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { conversationsApi } from "../../api/client";
import MessageList from "../chat/MessageList";
import { OrbBadge, Spinner } from "../ui/primitives";

export default function SharedView({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    conversationsApi
      .shared(token)
      .then((result) => {
        setData(result);
        document.title = `${result.title} · Nova`;
      })
      .catch((err) => setError(err.message));
  }, [token]);

  const openNova = () => {
    window.location.hash = "";
  };

  return (
    <div className="shared-page">
      <header className="shared-header glass">
        <div className="brand">
          <OrbBadge size={28} />
          <span className="brand-name">Nova</span>
        </div>
        <div className="shared-title">
          <strong>{data?.title || "Shared chat"}</strong>
          {data?.createdAt && <small>Shared conversation · {new Date(data.createdAt).toLocaleDateString()}</small>}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={openNova}>
          Try Nova <ArrowRight size={15} />
        </button>
      </header>

      {error && (
        <div className="shared-empty glass">
          <h1>Chat not available</h1>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={openNova}>
            Go to Nova
          </button>
        </div>
      )}

      {!data && !error && (
        <div className="center-fill">
          <Spinner size={28} />
        </div>
      )}

      {data && <MessageList messages={data.messages} readOnly busy={false} />}
    </div>
  );
}
