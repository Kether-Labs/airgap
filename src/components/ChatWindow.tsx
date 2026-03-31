import React, { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";

import ImageModal from "./ImageModal";
import { MessageType } from "../App";

interface ChatWindowProps {
    selectedPeerIp: string;
    selectedPeerName: string;
    messages: MessageType[];
    onDeleteMessage: (id: string) => void;
    onRetryMessage: (message: MessageType) => void;
    isTyping?: boolean; // ← reçu depuis App.tsx
}

// Trois points animés — indicateur "en train d'écrire"
const TypingIndicator: React.FC = () => (
    <div className="flex items-end gap-1 px-4 py-3 w-fit">
        <div className="bg-[#202c33] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
            <span
                className="w-2 h-2 bg-[#8696a0] rounded-full inline-block animate-bounce"
                style={{ animationDelay: "0ms", animationDuration: "1s" }}
            />
            <span
                className="w-2 h-2 bg-[#8696a0] rounded-full inline-block animate-bounce"
                style={{ animationDelay: "200ms", animationDuration: "1s" }}
            />
            <span
                className="w-2 h-2 bg-[#8696a0] rounded-full inline-block animate-bounce"
                style={{ animationDelay: "400ms", animationDuration: "1s" }}
            />
        </div>
    </div>
);

// Icône de statut message : ✓ envoyé (gris) ou ✓✓ délivré (bleu)
export const MessageStatus: React.FC<{ status?: "sent" | "delivered" }> = ({ status }) => {
    if (!status) return null;

    if (status === "delivered") {
        // Double coche bleue
        return (
            <span className="inline-flex items-center ml-1" title="Délivré">
                <svg viewBox="0 0 16 11" width="16" height="11" fill="none">
                    <path d="M1 5.5L4.5 9 9 2" stroke="#53bdeb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 5.5L8.5 9 15 2" stroke="#53bdeb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );
    }

    // Simple coche grise — envoyé mais pas encore délivré
    return (
        <span className="inline-flex items-center ml-1" title="Envoyé">
            <svg viewBox="0 0 10 11" width="10" height="11" fill="none">
                <path d="M1.5 5.5L4 8.5 8.5 2" stroke="#8696a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </span>
    );
};

const ChatWindow: React.FC<ChatWindowProps> = ({
    selectedPeerName,
    messages,
    onDeleteMessage,
    onRetryMessage,
    isTyping = false,
}) => {
    const endOfMessagesRef = useRef<HTMLDivElement>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    // Scroll automatique vers le bas à chaque nouveau message ou quand typing apparaît
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0b141a] relative z-0">

            {/* HEADER */}
            <header className="h-[59px] bg-[#202c33] px-4 flex items-center justify-between border-b border-[#202c33] z-20 shrink-0 shadow-md">
                <div className="flex items-center gap-4 cursor-pointer group">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold transition-transform group-hover:scale-105 shadow-sm">
                        {selectedPeerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[#e9edef] font-medium text-[16px] leading-tight">
                            {selectedPeerName}
                        </span>

                        {/* Statut dynamique : "en train d'écrire..." ou "en ligne" */}
                        <span
                            className={`text-[12px] transition-all duration-300 ${isTyping ? "text-[#00a884]" : "text-[#8696a0]"
                                }`}
                        >
                            {isTyping ? "en train d'écrire..." : "en ligne"}
                        </span>
                    </div>
                </div>

                <div className="text-[#aebac1] flex gap-5 items-center">
                    <button className="p-2 hover:bg-[#2a3942] rounded-full transition-colors active:bg-[#3b4a54]">
                        <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
                            <path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3 0-3.7-3-6.7-6.7-6.7S3 6 3 9.7s3 6.7 6.7 6.7c1.6 0 3.2-.6 4.3-1.6l.3.3v.8l5.1 5.1 1.5-1.5-5-5.2zm-6.2 0c-2.6 0-4.6-2.1-4.6-4.6s2.1-4.6 4.6-4.6 4.6 2.1 4.6 4.6-2 4.6-4.6 4.6z" />
                        </svg>
                    </button>
                    <button className="p-2 hover:bg-[#2a3942] rounded-full transition-colors active:bg-[#3b4a54]">
                        <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
                            <path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* MESSAGES AREA */}
            <div className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth chat-bg-pattern relative scrollbox shadow-inner scrollbar-thin scrollbar-thumb-wa-sidebar scrollbar-track-transparent">
                <div className="max-w-[1000px] mx-auto min-h-full flex flex-col">
                    {messages.length === 0 && !isTyping ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="bg-[#182229]/80 backdrop-blur-md border border-[#202c33] text-[#8696a0] px-5 py-2.5 rounded-xl text-[13px] shadow-lg text-center max-w-[85%]">
                                🔒 Les messages sont chiffrés de bout en bout. Aucune donnée ne quitte votre réseau local.
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col space-y-1 pb-4">
                            {/* Bandeau sécurité */}
                            <div className="flex justify-center mb-6">
                                <div className="bg-[#182229]/80 backdrop-blur-md border border-[#202c33] text-[#ffeecd]/90 px-4 py-1.5 rounded-lg text-[12px] shadow-sm text-center">
                                    🔒 Canal AirGap sécurisé avec {selectedPeerName}
                                </div>
                            </div>

                            {/* Bulles de messages */}
                            {messages.map((msg, idx) => (
                                <MessageBubble
                                    key={msg.id || idx}
                                    onRetry={() => onRetryMessage(msg)}
                                    message={msg}
                                    onDelete={() => onDeleteMessage(msg.id)}
                                    onImageClick={(url) => setPreviewImageUrl(url)}
                                />
                            ))}

                            {/* Indicateur "en train d'écrire" — apparaît sous les messages */}
                            {isTyping && (
                                <div className="flex items-center gap-2 animate-fade-in">
                                    <TypingIndicator />
                                </div>
                            )}

                            {/* Ancre de scroll */}
                            <div ref={endOfMessagesRef} className="h-2" />
                        </div>
                    )}
                </div>
            </div>

            {/* Media Preview Modal */}
            {previewImageUrl && (
                <ImageModal
                    imageUrl={previewImageUrl}
                    onClose={() => setPreviewImageUrl(null)}
                />
            )}
        </div>
    );
};

export default ChatWindow;