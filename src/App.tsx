import { useEffect, useState, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

// ... (rest of imports)

// Import UI Components
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import MessageInput from "./components/MessageInput";
import LoginScreen from "./components/LoginScreen";
import NotificationToast from "./components/NotificationToast";

interface AppToast {
  id: string;
  peerIp: string;
  name: string;
  content: string;
}

interface ChatMessage {
  sender_ip: string;
  sender_name: string;
  content: string;
  message_id: string;
}

// Structure renvoyée par la commande Rust get_history
interface DbMessage {
  sender_name: string;
  content: string;
  media_data?: string;
  media_type?: string;
  thumbnail?: string;
}

interface Peer {
  ip: string;
  name: string;
}

export interface MessageType {
  id: string;
  sender: string;
  text: string;
  time: string;
  mediaType?: "image" | "video" | "audio" | "document";
  mediaData?: string;
  filePath?: string; // Ajout du chemin brut pour ouverture système
  thumbnail?: string;
  status?: "sending" | "sent" | "delivered" | "failed";
}

// Convertit un DbMessage en MessageType
function dbMessageToMessageType(msg: DbMessage, myUsername: string): MessageType {
  const isImage = msg.media_type && msg.media_type.toLowerCase().includes("image");
  const isDocument = msg.media_type && (msg.media_type.includes("pdf") || msg.media_type.includes("document") || msg.media_type.includes("octet-stream"));
  const isMedia = isImage || isDocument || msg.content.toLowerCase().includes("[image") || msg.content.toLowerCase().includes("[document");

  let mediaData: string | undefined;
  let rawFilePath: string | undefined;
  let thumb: string | undefined;

  if (isMedia && msg.media_data) {
    // Détection stricte d'un chemin de fichier (doit commencer par / ou \ ou une lettre de lecteur sous Windows)
    const data = msg.media_data;
    const isFilePath = data.startsWith("/") || data.startsWith("\\") || /^[a-zA-Z]:\\/.test(data);

    if (isFilePath) {
      rawFilePath = data;
      mediaData = convertFileSrc(data);
      console.log("[DEBUG] Media Path Loading:", {
        original: data,
        converted: mediaData
      });
    } else {
      mediaData = data;
    }

    thumb = msg.thumbnail;
  }

  return {
    id: crypto.randomUUID(),
    sender: msg.sender_name === myUsername ? "Moi" : msg.sender_name,
    text: msg.content,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    mediaType: isImage ? "image" : (isDocument ? "document" : undefined),
    mediaData,
    filePath: rawFilePath,
    thumbnail: thumb,
  };
}

// Son de notification via Web Audio API — aucun fichier audio nécessaire
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Deux notes courtes — style notification moderne
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.12);

    gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.log("Son non disponible:", e);
  }
}

function App() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  const [activePeerIps, setActivePeerIps] = useState<string[]>([]);
  const [conflictPeers, setConflictPeers] = useState<Record<string, string>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [username, setUsername] = useState<string | null>(null);
  const [isSystemReady, setIsSystemReady] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [typingPeers, setTypingPeers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const [conversations, setConversations] = useState<Record<string, MessageType[]>>({});
  const [myIp, setMyIp] = useState<string>("");
  const [usernameConflictAlert, setUsernameConflictAlert] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const pendingUsername = useRef<string | null>(null);
  const selectedPeerRef = useRef<string | null>(null);


  useEffect(() => {
    selectedPeerRef.current = selectedPeer;
  }, [selectedPeer]);

  const handleRetryMessage = async (msg: MessageType) => {
    if (!selectedPeer) return;

    // Remet en "sending"
    setConversations((prev) => ({
      ...prev,
      [selectedPeer]: (prev[selectedPeer] || []).map((m) =>
        m.id === msg.id ? { ...m, status: "sending" } : m
      ),
    }));

    try {
      await invoke("send_message", {
        peerIp: selectedPeer,
        content: msg.text,
        msgId: msg.id, // réutilise le même ID
      });

      setConversations((prev) => ({
        ...prev,
        [selectedPeer]: (prev[selectedPeer] || []).map((m) =>
          m.id === msg.id ? { ...m, status: "sent" } : m
        ),
      }));
    } catch (e) {
      setConversations((prev) => ({
        ...prev,
        [selectedPeer]: (prev[selectedPeer] || []).map((m) =>
          m.id === msg.id ? { ...m, status: "failed" } : m
        ),
      }));
    }
  };

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      invoke("set_window_focused", { focused }).catch(() => { });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);
  useEffect(() => {
    const setup = async () => {
      const unlisten = await listen<string>("username-conflict", (event) => {
        const data = JSON.parse(event.payload);

        console.log("username-conflict reçu:", data); // ← log pour debug

        // Cas 1 — conflit pendant le login
        if (pendingUsername.current !== null &&
          pendingUsername.current === data.name) {
          setIsCheckingUsername(false);
          setLoginError(
            `"${data.name}" est déjà utilisé sur ce réseau. Choisis un autre pseudo.`
          );
          pendingUsername.current = null;
          invoke("set_username", { name: "" }).catch(() => { });
          return;
        }

        // Cas 2 — conflit après login
        setConflictPeers((prev) => ({ ...prev, [data.ip]: data.name }));
        if (data.name === username) {
          setUsernameConflictAlert(true);
        }
      });
      return unlisten;
    };

    const p = setup();
    return () => { p.then((fn) => fn && fn()); };
  }, []);

  useEffect(() => {
    invoke<{ ip: string; name: string }[]>("get_saved_peers")
      .then((saved) => {
        // ← Filtre notre propre IP
        const filtered = saved.filter((p) => p.ip !== myIp);
        if (filtered.length > 0) setPeers(filtered);
      })
      .catch(console.error);
  }, [myIp]);
  useEffect(() => {
    const appWindow = getCurrentWindow();

    // Informe Rust quand la fenêtre perd/reprend le focus
    const unlistenFocus = appWindow.onFocusChanged(({ payload: focused }) => {
      invoke("set_window_focused", { focused }).catch(() => { });
    });

    return () => { unlistenFocus.then((fn) => fn()); };
  }, []);
  // 1. Initialisation (get username)
  useEffect(() => {
    // Username
    invoke<string>("get_username")
      .then((name) => {
        setUsername(name);
        setIsSystemReady(true);
      })
      .catch(() => setIsSystemReady(true));

    // IP locale
    invoke<string>("get_my_ip")
      .then((ip) => setMyIp(ip))
      .catch(console.error);

    // Debug: log media directory
    invoke<string>("get_media_dir")
      .then((path) => console.log("[DEBUG] Absolute Media Directory:", path))
      .catch(console.error);

    // Permission notification Web
    //requestWebNotificationPermission();
  }, []);

  useEffect(() => {
    const setup = async () => {
      const unlisten = await listen<string>("peer-typing", (event) => {
        const data = JSON.parse(event.payload);
        const ip: string = data.ip;

        setTypingPeers((prev) => {
          // Annule le timeout précédent si il existe
          if (prev[ip]) clearTimeout(prev[ip]);

          // Nouveau timeout : efface le typing après 3s sans nouveau signal
          const timeout = setTimeout(() => {
            setTypingPeers((current) => {
              const next = { ...current };
              delete next[ip];
              return next;
            });
          }, 3000);

          return { ...prev, [ip]: timeout };
        });
      });
      return unlisten;
    };

    const promise = setup();
    return () => { promise.then((fn) => fn && fn()); };
  }, []);
  useEffect(() => {
    const setup = async () => {
      const unlisten = await listen<string>("peer-left", (event) => {
        const lostIp = event.payload;

        // ← Retire des actifs
        setActivePeerIps((current) => current.filter((ip) => ip !== lostIp));
      });
      return unlisten;
    };

    const promise = setup();
    return () => { promise.then((fn) => fn && fn()); };
  }, []);

  // Notifie le réseau qu'on quitte l'application
  useEffect(() => {
    const handleUnload = () => {
      invoke("notify_offline").catch(() => { });
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);
  // 2. Listener Pairs UDP
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<string>("peer-found", (event) => {
        try {
          const data = JSON.parse(event.payload);
          const peerIp: string = data.ip;

          if (peerIp === myIp) return;

          setActivePeerIps((current) =>
            current.includes(peerIp) ? current : [...current, peerIp]
          );
          const peerName: string = data.name;

          setPeers((current) => {
            const exists = current.find((p) => p.ip === peerIp);
            if (!exists) {
              // Pair qui revient ou nouveau → charge son historique
              if (username) loadHistoryForPeer(peerIp, username);
              return [...current, { ip: peerIp, name: peerName }];
            }
            return current.map((p) =>
              p.ip === peerIp ? { ...p, name: peerName } : p
            );
          });
        } catch (e) {
          console.error("Erreur parsing peer", e);
        }
      });
      return unlisten;
    };

    const unlistenPromise = setupListener();
    return () => {
      unlistenPromise.then((fn) => fn && fn());
    };
  }, []);

  useEffect(() => {
    const setup = async () => {
      const unlisten = await listen<string>("message-ack", (event) => {
        const ackedId = event.payload;
        setConversations((prev) => {
          const updated = { ...prev };
          for (const ip in updated) {
            updated[ip] = updated[ip].map((m) =>
              m.id === ackedId ? { ...m, status: "delivered" } : m
            );
          }
          return updated;
        });
      });
      return unlisten;
    };
    const p = setup();
    return () => { p.then((fn) => fn && fn()); };
  }, []);
  // 3. Listener Messages TCP entrants
  useEffect(() => {
    const setup = async () => {
      const unlisten = await listen<any>("media-received", (event) => {
        const data = event.payload;
        const msg = data.message;
        const senderIp = msg.sender_ip;
        const mediaTypeRaw = data.media_type || "";
        const isImage = mediaTypeRaw.includes("image");
        const isDocument = mediaTypeRaw.includes("pdf") || mediaTypeRaw.includes("document") || mediaTypeRaw.includes("octet-stream");

        setConversations((prev) => {
          const existing = prev[senderIp] || [];
          return {
            ...prev,
            [senderIp]: [
              ...existing,
              {
                id: msg.message_id,
                sender: msg.sender_name,
                text: msg.content || (isImage ? "[Image]" : "[Document]"),
                time: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                mediaType: isImage ? "image" : (isDocument ? "document" : undefined),
                mediaData: data.data,
                filePath: data.file_path, // Capture du chemin local
                thumbnail: data.thumbnail,
              },
            ],
          };
        });

        const isConversationActive = selectedPeerRef.current === senderIp;
        if (!isConversationActive) {
          setUnreadCounts((prev) => ({
            ...prev,
            [senderIp]: (prev[senderIp] || 0) + 1,
          }));
          playNotificationSound();
        }
      });

      return unlisten;
    };
    const p = setup();
    return () => { p.then((fn) => fn && fn()); };
  }, []);

  // 4. Listener Messages TCP entrants
  useEffect(() => {
    const setup = async () => {
      const unlisten = await listen<ChatMessage>("message-received", (event) => {
        const msg = event.payload;
        const senderIp = msg.sender_ip;

        // Ajoute le message dans la conversation
        setConversations((prev) => {
          const existing = prev[senderIp] || [];
          return {
            ...prev,
            [senderIp]: [
              ...existing,
              {
                id: msg.message_id,
                sender: msg.sender_name,
                text: msg.content,
                time: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            ],
          };
        });

        // Notification si la conversation n'est pas active
        const isConversationActive = selectedPeerRef.current === senderIp;

        if (!isConversationActive) {
          // Incrémente le badge non-lu
          setUnreadCounts((prev) => ({
            ...prev,
            [senderIp]: (prev[senderIp] || 0) + 1,
          }));

          // Son de notification
          playNotificationSound();

          // Notification Web (visible même si app au premier plan)
          // showWebNotification(msg.sender_name, msg.content);

          // Notification Toast "Telegram Style"
          //const newToastData: AppToast = {
          //id: msg.message_id || Date.now().toString(),
          //peerIp: senderIp,
          //name: msg.sender_name,
          //content: msg.content,
          //};
          //setToasts((prev) => [...prev, newToastData]);
        }
      });
      return unlisten;
    };
    const p = setup();
    return () => { p.then((fn) => fn && fn()); };
  }, []);

  // Charge l'historique SQLite d'un pair (appelé une seule fois par pair sélectionné)
  const loadHistoryForPeer = useCallback(
    async (peerIp: string, currentUsername: string) => {
      // Si on a déjà des messages en mémoire pour ce pair, on ne recharge pas
      setConversations((prev) => {
        if (prev[peerIp] !== undefined) return prev; // déjà chargé
        return prev;
      });

      // On vérifie proprement si déjà chargé
      setConversations((prev) => {
        if (prev[peerIp] !== undefined) return prev;

        // Lance le chargement async et met à jour l'état quand c'est prêt
        setIsLoadingHistory(true);
        invoke<DbMessage[]>("get_history", { peerIp })
          .then((history) => {
            setConversations((latest) => {
              // Si des messages sont arrivés entre-temps, on les garde
              const incoming = latest[peerIp] || [];
              const fromDb = history.map((m) =>
                dbMessageToMessageType(m, currentUsername)
              );

              // Déduplique : les messages en mémoire priment (arrivés pendant le chargement)
              return {
                ...latest,
                [peerIp]: fromDb.length > 0 ? fromDb : incoming,
              };
            });
          })
          .catch((e) => {
            console.error("Erreur chargement historique:", e);
          })
          .finally(() => {
            setIsLoadingHistory(false);
          });

        // Marque comme "en cours" avec un tableau vide pour éviter le double chargement
        return { ...prev, [peerIp]: [] };
      });
    },
    []
  );

  // Sélection d'un pair → charge l'historique si besoin
  const handleSelectPeer = useCallback(
    (peerIp: string | null) => {
      setSelectedPeer(peerIp);
      selectedPeerRef.current = peerIp;

      // ← Informe Rust de la conversation active
      invoke("set_active_peer", { peerIp: peerIp ?? "" }).catch(() => { });

      if (peerIp) {
        setUnreadCounts((prev) => ({ ...prev, [peerIp]: 0 }));
        if (username) loadHistoryForPeer(peerIp, username);
      }
    },
    [username, loadHistoryForPeer]
  );
  // Actions
  const handleLogin = async (name: string) => {
    setLoginError(null);
    setIsCheckingUsername(true);
    pendingUsername.current = name;

    try {
      // 1. Enregistre le username → Rust commence à broadcaster
      await invoke("set_username", { name });

      // 2. Attend 6s (un cycle broadcast + marge)
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // 3. Si on est toujours en train de checker → pas de conflit → valide
      if (pendingUsername.current === name) {
        pendingUsername.current = null;
        setIsCheckingUsername(false);
        setUsername(name); // ← confirme le login
      }
      // Si conflit → le listener a déjà annulé et affiché l'erreur

    } catch (e) {
      console.error("Erreur login", e);
      setIsCheckingUsername(false);
      setLoginError("Une erreur est survenue.");
    }
  };

  const handleUpdateUsername = async (name: string) => {
    try {
      await invoke("set_username", { name });
      setUsername(name);
    } catch (e) {
      console.error("Erreur update_username", e);
    }
  };

  const handleDeleteMessage = (peerIp: string, messageId: string) => {
    setConversations((prev) => {
      const existing = prev[peerIp] || [];
      return {
        ...prev,
        [peerIp]: existing.filter((m) => m.id !== messageId),
      };
    });
  };

  const generateUUID = () => {
    return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, () => {
      const r = Math.random() * 16 | 0;
      return r.toString(16);
    });
  };
  const handleSendMessage = async (content: string) => {
    if (!selectedPeer) return;

    const msgId = generateUUID();
    const newMessage: MessageType = {
      id: msgId,
      sender: "Moi",
      text: content,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "sending",
    };

    // Affiche immédiatement avec statut "sending"
    setConversations((prev) => ({
      ...prev,
      [selectedPeer]: [...(prev[selectedPeer] || []), newMessage],
    }));

    try {
      await invoke("send_message", {
        peerIp: selectedPeer,
        content,
        msgId,
      });

      // ✅ Met à jour le statut → "sent" (ne rajoute PAS le message)
      setConversations((prev) => ({
        ...prev,
        [selectedPeer]: (prev[selectedPeer] || []).map((m) =>
          m.id === msgId ? { ...m, status: "sent" } : m
        ),
      }));

    } catch (e) {
      console.error("Erreur d'envoi:", e);
      // ✅ Marque comme "failed"
      setConversations((prev) => ({
        ...prev,
        [selectedPeer]: (prev[selectedPeer] || []).map((m) =>
          m.id === msgId ? { ...m, status: "failed" } : m
        ),
      }));
    }
  };

  const handleSendMedia = async (media: { path: string; type: string; base64?: string; caption?: string }) => {
    if (!selectedPeer) return;

    const caption = media.caption || "";
    const isImage = media.type === "image";

    const msgId = generateUUID();
    const newMessage: MessageType = {
      id: msgId,
      sender: "Moi",
      text: caption || (isImage ? "[Image]" : "[Document]"),
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      mediaType: isImage ? "image" : "document",
      mediaData: media.base64,
      filePath: media.path,
      thumbnail: isImage ? media.base64 : undefined,
      status: "sending",
    };

    setConversations((prev) => ({
      ...prev,
      [selectedPeer]: [...(prev[selectedPeer] || []), newMessage],
    }));

    try {
      await invoke("send_media", {
        peerIp: selectedPeer,
        filePath: media.path,
        caption: caption || null,
      });

      setConversations((prev) => ({
        ...prev,
        [selectedPeer]: (prev[selectedPeer] || []).map((m) =>
          m.id === msgId ? { ...m, status: "sent" } : m
        ),
      }));

    } catch (e) {
      console.error("Erreur envoi média:", e);
      setConversations((prev) => ({
        ...prev,
        [selectedPeer]: (prev[selectedPeer] || []).map((m) =>
          m.id === msgId ? { ...m, status: "failed" } : m
        ),
      }));
    }
  };

  // Rendu conditionnel — écran de login si pas de username
  if (username === null || username === "") {
    return <LoginScreen onLogin={handleLogin} usernameConflictAlert={usernameConflictAlert} isSystemReady={isSystemReady} isChecking={isCheckingUsername} // ← nouveau
      error={loginError}              // ← nouveau
      onClearError={() => setLoginError(null)} />;
  }

  const currentMessages = selectedPeer ? conversations[selectedPeer] || [] : [];
  const selectedPeerObj = peers.find((p) => p.ip === selectedPeer);
  const peerName = selectedPeerObj
    ? selectedPeerObj.name
    : selectedPeer || "Utilisateur";

  const isSelectedPeerTyping = selectedPeer
    ? selectedPeer in typingPeers  // true si un timeout actif existe pour ce pair
    : false;
  return (
    <div className="flex h-screen aurora-bg text-zinc-100 font-sans overflow-hidden">
      <Sidebar
        peers={peers}
        conflictPeers={conflictPeers}
        selectedPeer={selectedPeer}
        setSelectedPeer={handleSelectPeer} // ← remplacé par handleSelectPeer
        username={username}
        onUpdateUsername={handleUpdateUsername}
        activePeerIps={activePeerIps}
        unreadCounts={unreadCounts}
      />


      {selectedPeer ? (
        <div className="flex-1 flex flex-col relative">
          {/* Indicateur de chargement de l'historique */}
          {isLoadingHistory && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-aurora-accent/20 backdrop-blur-md border border-aurora-accent/30 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
              Synchronisation...
            </div>
          )}
          <ChatWindow
            selectedPeerIp={selectedPeer}
            selectedPeerName={peerName}
            messages={currentMessages}
            isTyping={isSelectedPeerTyping}
            onDeleteMessage={(id) => handleDeleteMessage(selectedPeer, id)}
            onRetryMessage={handleRetryMessage}
          />
          <MessageInput
            onSendMessage={handleSendMessage}
            onSendMedia={handleSendMedia}
            selectedPeer={selectedPeer}
          />
        </div>
      ) : (
        // Modern Empty State
        <div className="flex-1 flex flex-col items-center justify-center aurora-bg relative overflow-hidden">
          {/* Decorative background glows */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-aurora-accent/5 blur-[120px] rounded-full animate-pulse"></div>

          <div className="max-w-md text-center relative z-10 animate-in fade-in zoom-in-95 duration-1000">
            <div className="mb-10 relative inline-block group">
              <div className="absolute inset-0 bg-aurora-accent/20 blur-3xl rounded-full scale-125 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <svg
                viewBox="0 0 24 24"
                height="160"
                width="160"
                className="mx-auto text-zinc-800 transition-transform duration-700 group-hover:scale-110"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth="2" strokeLinecap="round" />
                <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10 10 10 0 0 1-10-10 10 10 0 0 1 10-10z" strokeOpacity="0.1" />
              </svg>
            </div>

            <h1 className="text-4xl font-black text-white mb-4 tracking-tighter">
              Prêt à échanger ?
            </h1>
            <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-[0.2em] mb-8">
              Sélectionnez un pair actif pour <br />
              ouvrir un canal sécurisé.
            </p>

            <div className="flex items-center justify-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" /></svg>
                </div>
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Local</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" /></svg>
                </div>
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Chiffré</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-zinc-400">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13 2L3 14h9l-1 8L21 10h-9l1-8z" /></svg>
                </div>
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Rapide</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-10 flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5 backdrop-blur-md">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Node AirGap Opérationnel</span>
          </div>
        </div>
      )}

      {/* Toast Notifications Container (Telegram style) */}
      <div className="fixed top-4 right-4 z-[9999] pointer-events-none space-y-2 w-80">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <NotificationToast
              id={toast.id}
              peerIp={toast.peerIp}
              name={toast.name}
              content={toast.content}
              onClose={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
              onClick={(ip) => {
                setToasts((prev) => prev.filter((t) => t.peerIp !== ip));
                handleSelectPeer(ip);
              }}
            />
          </div>
        ))}


      </div>

      {/* Global Scrollbar Style */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(134, 150, 160, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(134, 150, 160, 0.4); }
      `}</style>
    </div>
  );
}

export default App;