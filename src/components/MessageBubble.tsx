import React from "react";
import { MessageType } from "../App";




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

    const isImage = message.text.startsWith("data:image:") || message.mediaType === "image";
    const hasMedia = message.mediaType === "image" && (message.mediaData || message.thumbnail);

    let mediaSrc: string | null = null;
    if (message.mediaData) {
        mediaSrc = message.mediaData;

        // On n'ajoute le préfixe base64 QUE si ce n'est pas déjà une URL (http, asset, tauri, data)
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

    const handleClick = (e: React.MouseEvent) => {
        // If it's an image click and we are NOT in selection mode, open modal
        // But if we are in selection mode, toggle selection
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
                className={`bubble relative max-w-[75%] rounded-2xl px-4 py-2.5 overflow-hidden transition-all duration-300 cursor-pointer select-none ${bubbleClasses}
                    ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}
                    ${isSelected ? 'ring-2 ring-aurora-accent ring-offset-2 ring-offset-zinc-900' : ''}
                `}
            >
                {hasMedia && mediaSrc ? (
                    <div className="-mx-1 -mt-1 mb-1.5">
                        <img
                            src={mediaSrc}
                            alt="Shared"
                            className="rounded-xl max-h-[400px] w-full object-contain cursor-zoom-in transition-transform hover:scale-[1.01]"
                            onClick={(e) => {
                                if (!isSelected) {
                                    e.stopPropagation();
                                    onImageClick && onImageClick(mediaSrc);
                                }
                            }}
                        />

                        {message.text && message.text !== "[Image]" && (
                            <p className="mt-2 text-[14.5px] leading-relaxed px-1 font-medium">{message.text}</p>
                        )}
                    </div>
                ) : isImage ? (
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
