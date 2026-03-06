import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core"; // Pour appeler les commandes Rust
import "./App.css";

// Interface pour typer les messages reçus de Rust
interface ChatMessage {
  sender_ip: string;
  content: string;
}

function App() {
  const [peers, setPeers] = useState<string[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  // On change la structure : un objet qui stocke les messages par IP
  // ex: { "127.0.0.1": [{text: "Salut", sender: "Moi"}] }
  const [conversations, setConversations] = useState<Record<string, { sender: string; text: string; time: string }[]>>({});

  const [inputValue, setInputValue] = useState("");

  // 1. Listener pour les Pairs (UDP)
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<string>("peer-found", (event) => {
        const peerIp = event.payload;
        setPeers((currentPeers) => {
          if (!currentPeers.includes(peerIp)) {
            return [...currentPeers, peerIp];
          }
          return currentPeers;
        });
      });
      return unlisten;
    };
    const unlistenPromise = setupListener();
    return () => { unlistenPromise.then((fn) => fn && fn()); };
  }, []);

  // 2. Listener pour les Messages (TCP)
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<ChatMessage>("message-received", (event) => {
        const msg = event.payload;
        const senderIp = msg.sender_ip;
        const content = msg.content;

        // On ajoute le message à la bonne conversation
        setConversations((prev) => {
          const existing = prev[senderIp] || [];
          return {
            ...prev,
            [senderIp]: [
              ...existing,
              {
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

  const handleSend = async () => {
    if (inputValue.trim() === "" || !selectedPeer) return;

    const newMessage = {
      sender: "Moi",
      text: inputValue,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Optimistic UI : On affiche le message tout de suite chez nous
    setConversations((prev) => {
      const existing = prev[selectedPeer] || [];
      return {
        ...prev,
        [selectedPeer]: [...existing, newMessage]
      };
    });

    // Appel au Backend Rust pour envoyer
    try {
      await invoke("send_message", {
        peerIp: selectedPeer.split(":")[0], // On envoie juste l'IP, le port est fixe (4243)
        content: inputValue
      });
      setInputValue("");
    } catch (e) {
      console.error("Erreur d'envoi:", e);
      alert("Impossible d'envoyer le message. Le pair est peut-être hors ligne.");
    }
  };

  // On récupère les messages du pair actuel
  const currentMessages = selectedPeer ? conversations[selectedPeer] || [] : [];

  return (
    // ... Garde le même JSX que tout à l'heure ...
    // C'est juste la logique 'messages' qui change pour utiliser 'currentMessages'
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden">

      {/* SIDEBAR (Identique) */}
      <aside className="w-80 flex flex-col border-r border-slate-800/50 bg-slate-900/40 backdrop-blur-xl">
        {/* ... copie-colle le code du sidebar ... */}
        {/* N'oublie pas de mapper les peers comme avant */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          <div className="px-2 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Utilisateurs en ligne
          </div>
          {peers.map((peer) => (
            <button
              key={peer}
              onClick={() => setSelectedPeer(peer)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${selectedPeer === peer
                ? "bg-indigo-600/10 border border-indigo-500/20 text-indigo-100"
                : "hover:bg-slate-800/50 border border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              {/* ... UI du bouton peer ... */}
              <div className="flex flex-col items-start min-w-0">
                <span className="font-medium truncate w-full text-sm">
                  {peer.split(":")[0]}
                </span>
                <span className="text-[10px] opacity-50 uppercase tracking-tighter">Connected</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 relative">
        {selectedPeer ? (
          <>
            {/* Header (Identique) */}
            <header className="h-[73px] px-8 flex items-center justify-between border-b border-slate-800/50 bg-slate-950/20 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <h2 className="font-bold text-slate-100 drop-shadow-sm">
                    {selectedPeer.split(":")[0]}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Canal sécurisé</span>
                  </div>
                </div>
              </div>
            </header>

            {/* Messages */}
            {/* NOTE: J'ai retiré l'empty state pour aller plus vite, tu peux le remettre */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar scroll-smooth">
              {currentMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center opacity-20 select-none">
                  <p>Commencez la discussion...</p>
                </div>
              ) : (
                currentMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.sender === "Moi" ? "items-end" : "items-start"}`}
                  >
                    <div className={`
                      max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm transition-all
                      ${msg.sender === "Moi"
                        ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/10"
                        : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50"}
                    `}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] mt-2 font-medium text-slate-500/80 px-1 uppercase tracking-tight">
                      {msg.sender === "Moi" ? "Vous" : msg.sender} • {msg.time}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <footer className="p-6 bg-slate-950/20 backdrop-blur-xl border-t border-slate-800/50">
              <div className="max-w-4xl mx-auto flex gap-4 p-1.5 bg-slate-900/60 rounded-2xl border border-slate-800/80 shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/40 transition-all duration-300">
                <input
                  type="text"
                  placeholder="Écrire un message chiffré..."
                  className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-slate-600"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-lg shadow-indigo-600/20 p-2.5 rounded-xl transition-all duration-200 group active:scale-95"
                >
                  {/* Icône Send */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"><line x1="22" y1="2" x2="11" y2="13" /><polyline points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            </footer>
          </>
        ) : (
          // Empty State (Identique)
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center overflow-hidden">
            <div className="relative z-10 max-w-md space-y-6">
              <div className="w-24 h-24 bg-slate-900 rounded-3xl mx-auto flex items-center justify-center border border-slate-800 shadow-2xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white">Sécurisé par AirGap</h2>
              <p className="text-slate-400 font-medium leading-relaxed">
                Sélectionnez un utilisateur à gauche.
              </p>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.2); border-radius: 20px; }
      `}</style>
    </div>
  );
}

export default App;