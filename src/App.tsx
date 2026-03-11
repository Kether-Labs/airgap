import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
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

function App() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  const [username, setUsername] = useState<string | null>(null);
  const [isSystemReady, setIsSystemReady] = useState<boolean>(false);

  const [conversations, setConversations] = useState<Record<string, MessageType[]>>({});

  // 1. Initialisation (get username)
  useEffect(() => {
    invoke<string>("get_username").then((name) => {
      setUsername(name);
      setIsSystemReady(true);
    }).catch((e) => {
      console.error("Erreur get_username", e);
      setIsSystemReady(true);
    });
  }, []);

  // 2. Listener Pairs UDP
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<string>("peer-found", (event) => {
        try {
          const data = JSON.parse(event.payload);
          const peerIp = data.ip;
          const peerName = data.name;

          setPeers((currentPeers) => {
            if (!currentPeers.find(p => p.ip === peerIp)) {
              return [...currentPeers, { ip: peerIp, name: peerName }];
            }
            return currentPeers.map(p => p.ip === peerIp ? { ...p, name: peerName } : p);
          });
        } catch (e) {
          console.error("Erreur parsing peer", e);
        }
      });
      return unlisten;
    };
    const unlistenPromise = setupListener();
    return () => { unlistenPromise.then((fn) => fn && fn()); };
  }, []);

  // 3. Listener Messages TCP
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<ChatMessage>("message-received", (event) => {
        const msg = event.payload;
        const senderIp = msg.sender_ip;
        const content = msg.content;

        setConversations((prev) => {
          const existing = prev[senderIp] || [];
          return {
            ...prev,
            [senderIp]: [
              ...existing,
              {
                id: crypto.randomUUID(),
                sender: senderIp,
                text: content,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]
          };
        });
      });
      return unlisten;
    };
    const unlistenPromise = setupListener();
    return () => { unlistenPromise.then((fn) => fn && fn()); };
  }, []);

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
        [peerIp]: existing.filter((m) => m.id !== messageId)
      };
    });
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedPeer) return;

    const newMessage: MessageType = {
      id: crypto.randomUUID(),
      sender: "Moi",
      text: content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Optimistic UI
    setConversations((prev) => {
      const existing = prev[selectedPeer] || [];
      return {
        ...prev,
        [selectedPeer]: [...existing, newMessage]
      };
    });

    try {
      await invoke("send_message", {
        peerIp: selectedPeer,
        content: content
      });
    } catch (e) {
      console.error("Erreur d'envoi:", e);
      alert("Impossible d'envoyer le message. Le pair est peut-être hors ligne.");
    }
  };

  // Rendu Conditionnel
  if (username === null || username === "") {
    return <LoginScreen onLogin={handleLogin} isSystemReady={isSystemReady} />;
  }

  const currentMessages = selectedPeer ? conversations[selectedPeer] || [] : [];
  const selectedPeerObj = peers.find(p => p.ip === selectedPeer);
  const peerName = selectedPeerObj ? selectedPeerObj.name : (selectedPeer || "Utilisateur");

  return (
    <div className="flex h-screen bg-[#111b21] text-[#e9edef] font-sans overflow-hidden">

      <Sidebar
        peers={peers}
        selectedPeer={selectedPeer}
        setSelectedPeer={setSelectedPeer}
        username={username}
        onUpdateUsername={handleUpdateUsername}
      />

      {selectedPeer ? (
        <div className="flex-1 flex flex-col relative">
          <ChatWindow
            selectedPeerIp={selectedPeer}
            selectedPeerName={peerName}
            messages={currentMessages}
            onDeleteMessage={(id) => handleDeleteMessage(selectedPeer, id)}
          />
          <MessageInput onSendMessage={handleSendMessage} />
        </div>
      ) : (
        // Empty state WhatsApp Web style
        <div className="flex-1 flex flex-col items-center justify-center bg-[#222e35] border-l border-[#202c33] relative">
          <div className="max-w-[80%] text-center border-b border-[#202c33]/20 pb-10">
            <svg viewBox="0 0 24 24" height="120" width="120" preserveAspectRatio="xMidYMid meet" className="mx-auto mb-8 text-[#46535d]" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" opacity=".8"></path><path d="M12 4c-4.41 0-8 3.59-8 8s3.59 8 8 8 8-3.59 8-8-3.59-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"></path></svg>
            <h1 className="text-3xl font-light text-[#e9edef] mb-4">AirGap pour Desktop</h1>
            <p className="text-[#8696a0] text-sm leading-relaxed max-w-md mx-auto">
              Envoyez et recevez des messages sécurisés sans connexion Internet via votre réseau local.
              <br />
              Sélectionnez un contact pour démarrer.
            </p>
          </div>
          <div className="absolute bottom-10 text-[#8696a0] text-xs flex items-center gap-1">
            <svg viewBox="0 0 10 12" height="12" width="10" preserveAspectRatio="xMidYMid meet" className="" fill="currentColor"><path d="M5 0C2.25 0 0 2.25 0 5v4.5C0 10.85 1.15 12 2.5 12h5c1.35 0 2.5-1.15 2.5-2.5V5c0-2.75-2.25-5-5-5zm0 1.5c1.95 0 3.5 1.55 3.5 3.5v.5h-7v-.5c0-1.95 1.55-3.5 3.5-3.5zM2.5 10.5C1.95 10.5 1.5 10.05 1.5 9.5V6.5h7v3c0 .55-.45 1-1 1h-5z"></path></svg>
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