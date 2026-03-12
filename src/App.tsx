import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

// Import UI Components
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import MessageInput from "./components/MessageInput";
import LoginScreen from "./components/LoginScreen";

interface ChatMessage {
  sender_ip: string;
  sender_name: string;
  content: string;
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

function App() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  const [username, setUsername] = useState<string | null>(null);
  const [isSystemReady, setIsSystemReady] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [typingPeers, setTypingPeers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const [conversations, setConversations] = useState<Record<string, MessageType[]>>({});


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
    invoke<string>("get_username")
      .then((name) => {
        setUsername(name);
        setIsSystemReady(true);
      })
      .catch((e) => {
        console.error("Erreur get_username", e);
        setIsSystemReady(true);
      });
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
        setPeers((current) => current.filter((p) => p.ip !== lostIp));

        // Si on était en train de chatter avec lui → désélectionne
        setSelectedPeer((current) => current === lostIp ? null : current);
      });
      return unlisten;
    };

    const promise = setup();
    return () => { promise.then((fn) => fn && fn()); };
  }, []);
  // 2. Listener Pairs UDP
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<string>("peer-found", (event) => {
        try {
          const data = JSON.parse(event.payload);
          const peerIp: string = data.ip;
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

  // 3. Listener Messages TCP entrants
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<ChatMessage>("message-received", (event) => {
        const msg = event.payload;
        const senderIp = msg.sender_ip;

        setConversations((prev) => {
          const existing = prev[senderIp] || [];
          return {
            ...prev,
            [senderIp]: [
              ...existing,
              {
                id: crypto.randomUUID(),
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
      });
      return unlisten;
    };

    const unlistenPromise = setupListener();
    return () => {
      unlistenPromise.then((fn) => fn && fn());
    };
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
      if (peerIp && username) {
        loadHistoryForPeer(peerIp, username);
      }
    },
    [username, loadHistoryForPeer]
  );

  // Actions
  const handleLogin = async (name: string) => {
    try {
      await invoke("set_username", { name });
      setUsername(name);
    } catch (e) {
      console.error("Erreur d'enregistrement", e);
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

  const handleSendMessage = async (content: string) => {
    if (!selectedPeer) return;

    const newMessage: MessageType = {
      id: crypto.randomUUID(),
      sender: "Moi",
      text: content,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    // Optimistic UI — on affiche immédiatement
    setConversations((prev) => {
      const existing = prev[selectedPeer] || [];
      return {
        ...prev,
        [selectedPeer]: [...existing, newMessage],
      };
    });

    try {
      await invoke("send_message", {
        peerIp: selectedPeer,
        content,
      });
      // La sauvegarde DB est gérée côté Rust dans send_message
    } catch (e) {
      console.error("Erreur d'envoi:", e);
      // Rollback optimiste en cas d'échec
      setConversations((prev) => {
        const existing = prev[selectedPeer] || [];
        return {
          ...prev,
          [selectedPeer]: existing.filter((m) => m.id !== newMessage.id),
        };
      });
      alert("Impossible d'envoyer le message. Le pair est peut-être hors ligne.");
    }
  };

  // Rendu conditionnel — écran de login si pas de username
  if (username === null || username === "") {
    return <LoginScreen onLogin={handleLogin} isSystemReady={isSystemReady} />;
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
        selectedPeer={selectedPeer}
        setSelectedPeer={handleSelectPeer} // ← remplacé par handleSelectPeer
        username={username}
        onUpdateUsername={handleUpdateUsername}
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