import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

// Définition du type pour être propre en TypeScript
interface PeerFoundEvent {
  payload: string;
}

function App() {
  const [peers, setPeers] = useState<string[]>([]);

  useEffect(() => {
    console.log("🚀 Frontend prêt, j'écoute le réseau...");

    // On utilise un async/await pour plus de clarté
    const setupListener = async () => {
      try {
        const unlisten = await listen<string>("peer-found", (event) => {
          console.log("✅ ÉVÉNEMENT REÇU DANS REACT :", event.payload);

          const peerIp = event.payload;

          // Mise à jour de la liste
          setPeers((currentPeers) => {
            // On vérifie si le pair est déjà là pour éviter les doublons
            if (!currentPeers.includes(peerIp)) {
              return [...currentPeers, peerIp];
            }
            return currentPeers;
          });
        });

        return unlisten; // Retourne la fonction de nettoyage
      } catch (error) {
        console.error("Erreur d'écoute Tauri :", error);
      }
    };

    const unlistenPromise = setupListener();

    // Nettoyage quand le composant est démonté
    return () => {
      unlistenPromise.then((unlisten) => {
        if (unlisten) unlisten();
      });
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>AirGap Scanner</h1>

      {/* Juste un test pour voir si React rafraîchit */}
      <p>Nombre de pairs : {peers.length}</p>

      <ul>
        {peers.map((peer, index) => (
          <li key={index} style={{ color: "green", fontWeight: "bold" }}>
            {peer}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;