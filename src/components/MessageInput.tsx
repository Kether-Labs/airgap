import React, { useState, useRef, useCallback } from "react";
import EmojiPicker, { Theme } from 'emoji-picker-react';

import { invoke } from "@tauri-apps/api/core";

interface MessageInputProps {
    onSendMessage: (message: string) => void;
    selectedPeer: string | null; // ← nécessaire pour send_typing
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, selectedPeer }) => {
    const [inputValue, setInputValue] = useState("");
    const [showPicker, setShowPicker] = useState(false);

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
                (
                <input
                    type="text"
                    placeholder="Taper un message"
                    className="w-full bg-transparent text-[#d1d7db] placeholder-[#8696a0] outline-none text-[15px]"
                    value={inputValue}
                    onChange={handleChange}
                    onKeyDown={(e) => e.key === "Enter" && handleSendText()}
                />
            </div>

            {/* Action Button */}

        </footer>
    );
};

export default MessageInput;