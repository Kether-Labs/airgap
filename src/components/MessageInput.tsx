import React, { useState, useRef, useCallback } from "react";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import compressImage from "../lib/compressImage";
import { invoke } from "@tauri-apps/api/core";

interface MessageInputProps {
    onSendMessage: (message: string) => void;
    selectedPeer: string | null; // ← nécessaire pour send_typing
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, selectedPeer }) => {
    const [inputValue, setInputValue] = useState("");
    const [showPicker, setShowPicker] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Throttle : on envoie un signal typing max toutes les 2s
    const lastTypingSent = useRef<number>(0);

    const sendTypingSignal = useCallback(() => {
        if (!selectedPeer) return;
        const now = Date.now();
        if (now - lastTypingSent.current < 2000) return; // throttle 2s
        lastTypingSent.current = now;
        invoke("send_typing", { peerIp: selectedPeer }).catch(() => { });
    }, [selectedPeer]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        if (e.target.value.trim()) sendTypingSignal();
    };

    const handleEmojiClick = (emojiData: any) => {
        setInputValue((prev) => prev + emojiData.emoji);
        sendTypingSignal();
    };

    const handleSendText = () => {
        if (inputValue.trim() === "") return;
        onSendMessage(inputValue);
        setInputValue("");
        setShowPicker(false);
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsCompressing(true);

        try {
            const compressedBase64 = await compressImage(file, 800, 0.7);
            const sizeInBytes = (compressedBase64.length - "data:image/jpeg;base64,".length) * 0.75;
            const maxSize = 500 * 1024;

            if (sizeInBytes > maxSize) {
                alert("Image trop lourde même après compression.");
            } else {
                onSendMessage(`data:image:${compressedBase64}`);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsCompressing(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <footer className="bg-[#0b141a] px-4 py-3 flex items-end gap-3 relative z-30 w-full min-h-[70px]">

            {/* Emoji & Attachment Buttons */}
            <div className="flex items-center gap-1 mb-1.5 flex-shrink-0">
                <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="text-[#8696a0] hover:text-[#d1d7db] p-2 rounded-full hover:bg-[#2a3942] transition-all"
                >
                    <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor">
                        <path d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363 1.108s-.669 1.959-5.051 1.959c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z" />
                    </svg>
                </button>


            </div>



            {showPicker && (
                <div className="absolute bottom-[75px] left-4 shadow-2xl rounded-2xl overflow-hidden border border-[#202c33]">
                    <EmojiPicker
                        theme={Theme.DARK}
                        onEmojiClick={handleEmojiClick}
                        searchDisabled={true}
                        skinTonesDisabled={true}
                        width={350}
                        height={400}
                    />
                </div>
            )}

            {/* Input Field */}
            <div className="flex-1 bg-[#2a3942] rounded-2xl relative px-5 py-2.5 mb-1 flex items-center min-h-[46px] shadow-sm transition-all focus-within:bg-[#32404b]">
                {isCompressing ? (
                    <div className="flex items-center gap-3 text-[#00a884] text-[14px] font-medium animate-pulse">
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                        <span>Traitement de l'image...</span>
                    </div>
                ) : (
                    <input
                        type="text"
                        placeholder="Taper un message"
                        className="w-full bg-transparent text-[#d1d7db] placeholder-[#8696a0] outline-none text-[15px]"
                        value={inputValue}
                        onChange={handleChange}
                        onKeyDown={(e) => e.key === "Enter" && handleSendText()}
                    />
                )}
            </div>

            {/* Action Button */}
            <button
                onClick={handleSendText}
                disabled={isCompressing}
                className={`mb-1 w-11 h-11 rounded-full flex items-center justify-center transition-all flex-shrink-0 shadow-lg ${inputValue.trim() || isCompressing
                    ? "bg-[#00a884] text-[#111b21] active:scale-95"
                    : "text-[#8696a0] hover:text-[#d1d7db]"
                    }`}
            >
                {inputValue.trim() || isCompressing ? (
                    <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor" className="ml-0.5">
                        <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor">
                        <path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.349 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.237 6.002s-6.237-2.471-6.237-6.002H3.761c0 4.001 3.178 7.297 7.061 7.885v3.884h2.354v-3.884c3.884-.588 7.061-3.884 7.061-7.885h-2.001z" />
                    </svg>
                )}
            </button>
        </footer>
    );
};

export default MessageInput;