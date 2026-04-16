import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useServerStore from "../../stores/useServerStore";
import type { ServerSummary, Channel } from "../../stores/useServerStore";
import styles from "../pages/chats/css/RoomList.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function JoinServerModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const fetchServers   = useServerStore((s) => s.fetchServers);
  const setChannels    = useServerStore((s) => s.setChannels);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const setActiveChannel = useServerStore((s) => s.setActiveChannel);

  const [publicServers, setPublicServers] = useState<ServerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;

    const fetchPublicServers = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/servers", {
          credentials: "include",
        });

        if (!res.ok) {
          setError("No se pudo cargar la lista de servidores.");
          return;
        }

        const body = await res.json();
        const all: ServerSummary[] = body.data ?? body;
        // Only show public servers the user hasn't joined yet
        setPublicServers(all.filter((s) => s.is_public && !s.member_role));
      } catch {
        setError("Error de red al cargar los servidores.");
      } finally {
        setLoading(false);
      }
    };

    fetchPublicServers();
  }, [open]);

  if (!open) return null;

  const handleJoin = async (serverId: string) => {
    setJoiningId(serverId);
    setError(null);

    try {
      const res = await fetch(`/api/servers/${serverId}/join`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.status === 409) {
        setError("Ya sos miembro de ese servidor.");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "No se pudo unirse al servidor.");
        return;
      }

      // Parse response to navigate directly to the server's default channel
      const responseBody = await res.json().catch(() => null);
      const detail = responseBody?.data ?? null;

      setJoinedIds((prev) => new Set(prev).add(serverId));
      await fetchServers();

      // Navigate to default channel if we have it in the response
      if (detail) {
        const channels: Channel[] = detail.channels ?? [];
        setChannels(serverId, channels);
        setActiveServer(detail);
        const defaultChannel = channels.find((c: Channel) => c.is_default) ?? channels[0];
        if (defaultChannel) {
          setActiveChannel(defaultChannel);
          navigate(`/servers/${serverId}/channels/${defaultChannel.id}`);
          onClose();
        }
      }
    } catch {
      setError("Error de red al unirse al servidor.");
    } finally {
      setJoiningId(null);
    }
  };

  const handleClose = () => {
    setError(null);
    setJoinedIds(new Set());
    onClose();
  };

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") handleClose();
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-server-title"
        style={{ maxWidth: "480px" }}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 id="join-server-title" className={styles.modalTitle}>
            Explorar servidores
          </h2>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={handleClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Note about private servers */}
        <p style={{ margin: 0, fontSize: "12px", color: "#555", lineHeight: 1.5 }}>
          Servidores públicos disponibles. Para unirte a un servidor privado, pedile el código de invitación al admin.
        </p>

        {/* Server list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "360px",
            overflowY: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "#222 transparent",
          }}
        >
          {loading && (
            <p style={{ textAlign: "center", color: "#555", fontSize: "13px", padding: "24px 0" }}>
              Cargando servidores…
            </p>
          )}

          {!loading && publicServers.length === 0 && (
            <p style={{ textAlign: "center", color: "#444", fontSize: "13px", padding: "24px 0" }}>
              No hay servidores públicos disponibles.
            </p>
          )}

          {!loading &&
            publicServers.map((server) => {
              const alreadyJoined = joinedIds.has(server.id);
              const isJoining = joiningId === server.id;

              return (
                <div
                  key={server.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "12px",
                    transition: "border-color 150ms",
                  }}
                >
                  {/* Server avatar */}
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "12px",
                      background: "#111",
                      border: "1px solid #222",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {server.image ? (
                      <img
                        src={server.image}
                        alt={server.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px" }}
                      />
                    ) : (
                      "🌐"
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#ddd",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {server.name}
                    </p>
                    {server.description && (
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: "11px",
                          color: "#555",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {server.description}
                      </p>
                    )}
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#0f6" }}>
                      {server.member_count} {server.member_count === 1 ? "miembro" : "miembros"}
                    </p>
                  </div>

                  {/* Join button */}
                  <button
                    type="button"
                    onClick={() => handleJoin(server.id)}
                    disabled={isJoining || alreadyJoined}
                    style={{
                      flexShrink: 0,
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: alreadyJoined ? "1px solid rgba(0,255,102,0.3)" : "none",
                      background: alreadyJoined
                        ? "rgba(0,255,102,0.08)"
                        : isJoining
                        ? "rgba(0,255,102,0.5)"
                        : "#0f6",
                      color: alreadyJoined ? "#0f6" : "#000",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: alreadyJoined || isJoining ? "not-allowed" : "pointer",
                      transition: "background 200ms",
                      opacity: isJoining ? 0.7 : 1,
                    }}
                  >
                    {alreadyJoined ? "Unido ✓" : isJoining ? "Uniéndose…" : "Unirse"}
                  </button>
                </div>
              );
            })}
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Footer note about invite code */}
        <div
          style={{
            padding: "12px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "10px",
            fontSize: "12px",
            color: "#555",
          }}
        >
          <strong style={{ color: "#666" }}>Nota (Fase 2):</strong> La unión por código de invitación requiere un endpoint <code style={{ color: "#888" }}>/api/servers/join-by-code</code> que aún no está implementado en el backend.
        </div>

        {/* Close */}
        <button type="button" className={styles.modalCancelBtn} onClick={handleClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
