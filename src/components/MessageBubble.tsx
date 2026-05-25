import React from "react";
import { MessageType } from "../App";
import { invoke } from "@tauri-apps/api/core";




interface MessageBubbleProps {
    message: MessageType;
    onDelete?: () => void;
    onImageClick?: (url: string) => void;
    onRetry: (message: MessageType) => void;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onDelete, onImageClick, onRetry, isSelected, onSelect }) => {
    const isMe = message.sender === "Moi";

    const bubbleClasses = isMe
        ? "bg-gradient-to-br from-aurora-accent to-[#008f6f] text-white shadow-lg shadow-aurora-accent/10"
        : "bg-zinc-800 text-zinc-100 shadow-md";

    const timeColor = isMe ? "text-white/60" : "text-zinc-500";

    const isImage = message.mediaType === "image";
    const isDocument = message.mediaType === "document" || (!isImage && message.text.includes("[application/"));

    // Détermination de l'icône et du nom pour les documents
    const getFileIcon = () => {
        const text = message.text.toLowerCase();
        if (text.includes(".pdf") || text.includes("pdf")) {
            return (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="text-red-400">
                    <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3.5h-3V10h2v1.5h-2V13h-1.5V7h4.5v1.5zM9 9.5h1v-1H9v1zM14 12h1V8.5h-1V12zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z" />
                </svg>
            );
        }
        if (text.includes(".doc") || text.includes("word") || text.includes("document")) {
            return (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="text-blue-400">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                </svg>
            );
        }
        return (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="text-zinc-400">
                <path d="M13 1.07V9h7c0-4.08-3.05-7.44-7-7.93zM4 15c0 4.42 3.58 8 8 8s8-3.58 8-8v-4H4v4zm7-13.93C7.05 1.56 4 4.92 4 9h7V1.07z" />
            </svg>
        );
    };

    const hasMedia = (isImage || isDocument) && (message.mediaData || message.thumbnail);

    let mediaSrc: string | null = null;
    if (message.mediaData) {
        mediaSrc = message.mediaData;
        const isUrl = mediaSrc.startsWith("http") ||
            mediaSrc.startsWith("asset:") ||
            mediaSrc.startsWith("tauri:") ||
            mediaSrc.startsWith("data:");

        if (!isUrl) {
            mediaSrc = `data:image/jpeg;base64,${mediaSrc}`;
        }
    } else if (message.thumbnail) {
        const thumb = message.thumbnail.startsWith("data:") ? message.thumbnail : `data:image/jpeg;base64,${message.thumbnail}`;
        mediaSrc = thumb;
    }

    const handleFileAction = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (message.filePath) {
            console.log("[DEBUG] Opening file:", message.filePath);
            invoke("open_file", { path: message.filePath })
                .catch(console.error);
        } else if (message.mediaData) {
            // Fallback pour les anciens messages ou base64
            const a = document.createElement("a");
            a.href = mediaSrc || "";
            a.download = message.text.split(" ").pop() || "download";
            a.click();
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        if (isImage && !isSelected && !onSelect) {
            return; // let image click handler work
        }

        if (onSelect) {
            e.stopPropagation();
            onSelect(message.id);
        }
    };

    return (
        <div
            className={`flex ${isMe ? "justify-end" : "justify-start"} mb-3 animate-message group relative transition-all duration-300
                ${isSelected ? "message-selected" : ""}
            `}
            onClick={handleClick}
        >

            <div
                className={`bubble relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 overflow-hidden transition-all duration-300 cursor-pointer select-none ${bubbleClasses}
                    ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}
                    ${isSelected ? 'ring-2 ring-aurora-accent ring-offset-2 ring-offset-zinc-900' : ''}
                `}
            >
                {isImage && hasMedia && mediaSrc ? (
                    <div className="-mx-1 -mt-1 mb-1.5">
                        <img
                            src={mediaSrc}
                            alt="Shared"
                            className="rounded-xl max-h-[400px] w-full object-contain cursor-zoom-in transition-transform hover:scale-[1.01]"
                            onClick={(e) => {
                                if (!isSelected) {
                                    e.stopPropagation();
                                    onImageClick && onImageClick(mediaSrc!);
                                }
                            }}
                        />
                        {message.text && !message.text.includes("[image") && (
                            <p className="mt-2 text-[14.5px] leading-relaxed px-1 font-medium">{message.text}</p>
                        )}
                    </div>
                ) : isDocument ? (
                    <div className="flex flex-col gap-2 min-w-[200px]" onClick={handleFileAction}>
                        <div className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? 'bg-white/10' : 'bg-white/5'} border border-white/5 hover:bg-white/20 transition-all cursor-pointer group/doc`}>
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMe ? 'bg-white/20' : 'bg-zinc-700/50'} group-hover/doc:scale-110 transition-transform`}>
                                {getFileIcon()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold truncate">
                                    {message.text.replace(/\[.*?\]\s*/, "") || "Document"}
                                </p>
                                <p className={`text-[10px] uppercase font-bold tracking-widest ${isMe ? 'text-white/50' : 'text-zinc-500'}`}>
                                    {message.text.match(/\[(.*?)\]/)?.[1]?.split("/").pop()?.toUpperCase() || "FILE"}
                                </p>
                            </div>
                            <div
                                className={`p-2 rounded-lg transition-all ${isMe ? 'text-white' : 'text-aurora-accent'}`}
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                ) : isImage && message.text.startsWith("data:image:") ? (
                    <div className="-mx-1 -mt-1">
                        <img
                            src={message.text}
                            alt="Shared"
                            className="rounded-xl max-h-[400px] w-full object-contain cursor-zoom-in transition-transform hover:scale-[1.01]"
                            onClick={(e) => {
                                if (!isSelected) {
                                    e.stopPropagation();
                                    onImageClick && onImageClick(message.text);
                                }
                            }}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <span className="break-words text-[14.5px] leading-[22px] pr-2 font-medium">
                            {message.text}
                        </span>
                    </div>
                )}


                {/* Footer: Time + Status */}
                <div className="flex items-center justify-end gap-1.5 mt-1 select-none">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${timeColor}`}>
                        {message.time}
                    </span>
                    {isMe && (
                        <div className="flex items-center">
                            {message.status === "failed" ? (
                                <button onClick={(e) => { e.stopPropagation(); onRetry(message); }} className="text-red-300 hover:text-white transition-colors">
                                    <svg viewBox="0 0 16 16" height="12" width="12" fill="currentColor"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" /><path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" /></svg>
                                </button>
                            ) : (
                                <svg viewBox="0 0 16 16" height="12" width="12" className={message.status === "delivered" ? "text-emerald-300" : "text-white/40"} fill="currentColor">
                                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                                    <path d="M10.354 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L3 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                                </svg>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
