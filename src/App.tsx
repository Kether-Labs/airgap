import { useEffect, useState, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

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
  status?: "sending" | "sent" | "delivered" | "failed";
}

// Convertit un DbMessage en MessageType (pas de timestamp stocké en lisible → on affiche rien)
function dbMessageToMessageType(msg: DbMessage, myUsername: string): MessageType {
  return {
    id: crypto.randomUUID(),
    sender: msg.sender_name === myUsername ? "Moi" : msg.sender_name,
    text: msg.content,
    time: "", // L'historique DB n'a pas de timestamp formaté pour l'instant
  };
}

async function requestWebNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
    console.log("Permission notification:", Notification.permission);
  }
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

// Affiche une notification Web (dans le navigateur/WebView)
function showWebNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/icon.png",
      silent: true, // on gère le son nous-mêmes
    });
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

    // Permission notification Web
    requestWebNotificationPermission();
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
          showWebNotification(msg.sender_name, msg.content);

          // Notification Toast "Telegram Style"
          const newToastData: AppToast = {
            id: msg.message_id || Date.now().toString(),
            peerIp: senderIp,
            name: msg.sender_name,
            content: msg.content,
          };
          setToasts((prev) => [...prev, newToastData]);
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

      if (peerIp) {
        // Remet à zéro les non-lus
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
    <div className="flex h-screen bg-[#111b21] text-[#e9edef] font-sans overflow-hidden">
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
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-[#202c33] text-[#8696a0] text-xs px-3 py-1 rounded-full shadow">
              Chargement de l'historique…
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
            selectedPeer={selectedPeer}
          />
        </div>
      ) : (
        // Empty state WhatsApp Web style
        <div className="flex-1 flex flex-col items-center justify-center bg-[#222e35] border-l border-[#202c33] relative">
          <div className="max-w-[80%] text-center border-b border-[#202c33]/20 pb-10">
            <svg
              viewBox="0 0 24 24"
              height="120"
              width="120"
              preserveAspectRatio="xMidYMid meet"
              className="mx-auto mb-8 text-[#46535d]"
              fill="currentColor"
            >
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"
                opacity=".8"
              />
              <path d="M12 4c-4.41 0-8 3.59-8 8s3.59 8 8 8 8-3.59 8-8-3.59-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" />
            </svg>
            <h1 className="text-3xl font-light text-[#e9edef] mb-4">
              AirGap pour Desktop
            </h1>
            <p className="text-[#8696a0] text-sm leading-relaxed max-w-md mx-auto">
              Envoyez et recevez des messages sécurisés sans connexion Internet
              via votre réseau local.
              <br />
              Sélectionnez un contact pour démarrer.
            </p>
          </div>
          <div className="absolute bottom-10 text-[#8696a0] text-xs flex items-center gap-1">
            <svg
              viewBox="0 0 10 12"
              height="12"
              width="10"
              preserveAspectRatio="xMidYMid meet"
              fill="currentColor"
            >
              <path d="M5 0C2.25 0 0 2.25 0 5v4.5C0 10.85 1.15 12 2.5 12h5c1.35 0 2.5-1.15 2.5-2.5V5c0-2.75-2.25-5-5-5zm0 1.5c1.95 0 3.5 1.55 3.5 3.5v.5h-7v-.5c0-1.95 1.55-3.5 3.5-3.5zM2.5 10.5C1.95 10.5 1.5 10.05 1.5 9.5V6.5h7v3c0 .55-.45 1-1 1h-5z" />
            </svg>
            Chiffré de bout en bout
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