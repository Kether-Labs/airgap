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
    isTyping?: boolean;
}

const TypingIndicator: React.FC = () => (
    <div className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800/50 backdrop-blur-sm rounded-full w-fit mb-4 ml-2 border border-white/5 animate-pulse">
        <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-aurora-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-aurora-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-aurora-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">En train d'écrire</span>
    </div>
);

const ChatWindow: React.FC<ChatWindowProps> = ({
    selectedPeerName,
    messages,
    onDeleteMessage,
    onRetryMessage,
    isTyping = false,
}) => {
    const endOfMessagesRef = useRef<HTMLDivElement>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const handleSelectMessage = (id: string) => {
        setSelectedMessageId(prev => prev === id ? null : id);
    };

    const handleDeleteSelected = () => {
        if (selectedMessageId) {
            onDeleteMessage(selectedMessageId);
            setSelectedMessageId(null);
        }
    };

    return (
        <div 
            className="flex-1 flex flex-col min-h-0 aurora-bg relative z-0"
            onClick={() => setSelectedMessageId(null)}
        >

            {/* HEADER */}
            <header className="h-16 glass px-6 flex items-center justify-between z-20 shrink-0 border-b border-white/5 transition-all duration-500">
                {selectedMessageId ? (
                    <div className="flex items-center justify-between w-full animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setSelectedMessageId(null)}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                            >
                                <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
                            </button>
                            <span className="text-white font-bold text-lg uppercase tracking-widest">1 sélectionné</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteSelected(); }}
                                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <svg viewBox="0 0 24 24" height="16" width="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>
                                Supprimer
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-4 cursor-pointer group animate-in fade-in duration-500">
                            <div className="w-10 h-10 rounded-xl bg-aurora-accent flex items-center justify-center text-white font-bold shadow-lg shadow-aurora-accent/20 transition-transform group-hover:scale-105">
                                {selectedPeerName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-white font-bold text-base leading-tight">
                                    {selectedPeerName}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isTyping ? 'bg-aurora-accent animate-pulse' : 'bg-emerald-500'}`} />
                                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                                        {isTyping ? "Écrit..." : "En ligne"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 animate-in fade-in duration-500">
                            <button className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                                <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
                                    <path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3 0-3.7-3-6.7-6.7-6.7S3 6 3 9.7s3 6.7 6.7 6.7c1.6 0 3.2-.6 4.3-1.6l.3.3v.8l5.1 5.1 1.5-1.5-5-5.2zm-6.2 0c-2.6 0-4.6-2.1-4.6-4.6s2.1-4.6 4.6-4.6 4.6 2.1 4.6 4.6-2 4.6-4.6 4.6z" />
                                </svg>
                            </button>
                            <button className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                                <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
                                    <path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z" />
                                </svg>
                            </button>
                        </div>
                    </>
                )}
            </header>

            {/* MESSAGES AREA */}
            <div className="flex-1 overflow-y-auto px-6 py-6 scrollbox">
                <div className="max-w-4xl mx-auto min-h-full flex flex-col">
                    {messages.length === 0 && !isTyping ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="bg-white/5 backdrop-blur-md border border-white/5 text-zinc-400 px-6 py-3 rounded-2xl text-xs font-medium tracking-wide shadow-xl text-center flex items-center gap-3">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-aurora-accent"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/></svg>
                                Les messages sont chiffrés de bout en bout localement.
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col pb-4">
                            {/* Security Info */}
                            <div className="flex justify-center mb-8">
                                <div className="bg-aurora-accent/10 border border-aurora-accent/20 text-aurora-accent px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm">
                                    Canal sécurisé avec {selectedPeerName}
                                </div>
                            </div>

                            {/* Message List */}
                            {messages.map((msg, idx) => (
                                <MessageBubble
                                    key={msg.id || idx}
                                    onRetry={() => onRetryMessage(msg)}
                                    message={msg}
                                    onDelete={() => onDeleteMessage(msg.id)}
                                    onImageClick={(url) => setPreviewImageUrl(url)}
                                    isSelected={selectedMessageId === msg.id}
                                    onSelect={handleSelectMessage}
                                />
                            ))}

                            {isTyping && <TypingIndicator />}

                            <div ref={endOfMessagesRef} className="h-4" />
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
