import React from "react";
import { MessageType } from "../App";




interface MessageBubbleProps {
    message: MessageType;
    onDelete?: () => void;
    onImageClick?: (url: string) => void;
    onRetry: (message: MessageType) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onDelete, onImageClick, onRetry }) => {
    const isMe = message.sender === "Moi";

    // WhatsApp Colors
    const bubbleColor = isMe ? "bg-[#005c4b]" : "bg-[#202c33]";
    const textColor = "text-[#e9edef]";
    const timeColor = "text-[#8696a0]";

    const isImage = message.text.startsWith("data:image:");

    return (
        <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300 relative group`}>
            {/* Delete Button (Trash Icon) - Visible on Hover */}
            <button
                onClick={onDelete}
                className={`absolute top-0 ${isMe ? '-left-8' : '-right-8'} p-1.5 text-[#8696a0] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110 z-20`}
                title="Supprimer le message"
            >
                <svg viewBox="0 0 24 24" height="18" width="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>
            </button>

            {/* Triangle Tail */}
            <div
                className={`absolute top-0 w-2 h-3.5 ${bubbleColor} z-10`}
                style={
                    isMe
                        ? { right: '-4px', clipPath: 'polygon(0 0, 0 100%, 100% 0)' }
                        : { left: '-4px', clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }
                }
            />

            <div
                className={`relative max-w-[65%] rounded-2xl ${bubbleColor} ${textColor} px-3 py-2 shadow-md text-[14.5px] leading-[20px] overflow-hidden transition-all`}
                style={
                    isMe ? { borderTopRightRadius: '4px' } : { borderTopLeftRadius: '4px' }
                }
            >
                {isImage ? (
                    <div className="p-0.5">
                        <img
                            src={message.text}
                            alt="Shared"
                            className="rounded-xl max-h-[350px] w-full object-contain cursor-zoom-in shadow-inner transition-opacity hover:opacity-90"
                            onClick={() => onImageClick && onImageClick(message.text)}
                        />
                    </div>
                ) : (
                    <>
                        <span className="break-words block mb-1 pr-10">{message.text}</span>

                    </>
                )}

                {message.sender === "Moi" && message.status === "failed" && (
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-red-400 text-[11px]">
                            Échec d'envoi
                        </span>
                        <button
                            onClick={() => onRetry(message)} // ← nouveau callback
                            className="text-[11px] text-[#00a884] hover:underline"
                        >
                            Réessayer
                        </button>
                    </div>
                )}

                <div className={`flex items-center justify-end gap-1.5 mt-0.5 ${isImage ? 'absolute bottom-2 right-3 px-2 py-0.5 bg-black/40 backdrop-blur-sm rounded-full text-white' : 'absolute bottom-1 right-2'}`}>
                    <span className={`text-[10px] ${isImage ? 'text-white' : timeColor} font-medium`}>
                        {message.time}
                    </span>
                    {isMe && (
                        <svg viewBox="0 0 16 16" height="13" width="14" preserveAspectRatio="xMidYMid meet" className="text-[#53bdeb]" fill="currentColor"><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a3.2 3.2 0 0 1-.484.386l-1.428-1.516a.366.366 0 0 0-.546-.033l-.382.355a.363.363 0 0 0-.038.508l2.008 2.378c.184.218.428.327.674.327h.044c.264 0 .524-.131.701-.363l5.856-7.59a.366.366 0 0 0-.061-.516h.001z"></path><path d="M12.222 3.316l-.478-.372a.365.365 0 0 0-.51.063L5.878 9.88a3.2 3.2 0 0 1-.484.386l-1.428-1.516a.366.366 0 0 0-.546-.033l-.382.355a.363.363 0 0 0-.038.508l2.008 2.378c.184.218.428.327.674.327h.044c.264 0 .524-.131.701-.363l5.856-7.59a.366.366 0 0 0-.061-.516h.001z"></path></svg>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
