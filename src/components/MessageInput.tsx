import React, { useState, useRef, useCallback } from "react";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { invoke } from "@tauri-apps/api/core";

interface MediaPreview {
    path: string;
    base64: string;
}

interface MessageInputProps {
    onSendMessage: (message: string) => void;
    onSendMedia: (data: { path: string; type: string; base64?: string; caption?: string }) => void;
    selectedPeer: string | null;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, onSendMedia, selectedPeer }) => {
    const [inputValue, setInputValue] = useState("");
    const [showPicker, setShowPicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);

    const lastTypingSent = useRef<number>(0);

    const sendTypingSignal = useCallback(() => {
        if (!selectedPeer) return;
        const now = Date.now();
        if (now - lastTypingSent.current < 2000) return;
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

    const handleAttachClick = async () => {
        if (!selectedPeer) return;

        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Images',
                    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
                }]
            });

            if (selected) {
                setIsUploading(true);
                const filePath = selected as string;

                try {
                    const fileData = await readFile(filePath);
                    const base64 = btoa(
                        new Uint8Array(fileData).reduce((data, byte) => data + String.fromCharCode(byte), '')
                    );
                    setMediaPreview({ path: filePath, base64 });
                } catch {
                    setMediaPreview({ path: filePath, base64: "" });
                }

                setIsUploading(false);
            }
        } catch (e) {
            console.error("Erreur sélection fichier:", e);
            setIsUploading(false);
        }
    };

    const handleSendMedia = () => {
        if (!mediaPreview) return;
        onSendMedia({
            path: mediaPreview.path,
            type: "image",
            base64: mediaPreview.base64,
            caption: inputValue.trim() || undefined
        });
        setMediaPreview(null);
        setInputValue("");
    };

    const handleCancelMedia = () => {
        setMediaPreview(null);
    };

    return (
        <div className="relative z-30 w-full">
            {/* Media Preview Modal */}
            {mediaPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b141a]/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111b21] w-[450px] max-w-[90vw] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[#202c33]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4">
                            <h2 className="text-[#e9edef] text-[18px] font-medium">Aperçu de l'image</h2>
                            <button
                                onClick={handleCancelMedia}
                                className="text-[#8696a0] hover:text-[#d1d7db] hover:bg-[#202c33] p-1.5 rounded-full transition-colors"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                            </button>
                        </div>

                        {/* Image Preview Area */}
                        <div className="relative w-full max-h-[350px] bg-[#0b141a] flex items-center justify-center p-0 border-y border-[#202c33]">
                            {mediaPreview.base64 ? (
                                <img
                                    src={`data:image/jpeg;base64,${mediaPreview.base64}`}
                                    alt="Aperçu"
                                    className="max-h-[350px] max-w-full object-contain"
                                />
                            ) : (
                                <div className="h-[200px] flex items-center justify-center text-[#8696a0]">
                                    Chargement...
                                </div>
                            )}
                        </div>

                        {/* Options / Footer Section */}
                        <div className="px-6 py-5 flex flex-col gap-4">
                            {/* Caption Input */}
                            <div className="flex items-center relative border-b-2 border-[#202c33] pb-2 focus-within:border-[#00a884] transition-colors">
                                <input
                                    type="text"
                                    placeholder="Ajouter une légende..."
                                    className="w-full bg-transparent text-[#e9edef] placeholder-[#8696a0] outline-none text-[15px]"
                                    value={inputValue}
                                    onChange={handleChange}
                                    onKeyDown={(e) => e.key === "Enter" && handleSendMedia()}
                                />
                                <button
                                    onClick={() => setShowPicker(!showPicker)}
                                    className={`${showPicker ? 'text-[#00a884]' : 'text-[#8696a0]'} hover:text-[#00a884] transition-colors`}
                                >
                                    <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor">
                                        <path d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363 1.108s-.669 1.959-5.051 1.959c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z" />
                                    </svg>
                                </button>

                                {/* Emoji Picker for Modal */}
                                {showPicker && (
                                    <div className="absolute bottom-full right-0 mb-4 shadow-2xl rounded-2xl overflow-hidden border border-[#202c33] z-50 animate-in slide-in-from-bottom-2 duration-200">
                                        <EmojiPicker
                                            theme={Theme.DARK}
                                            onEmojiClick={handleEmojiClick}
                                            searchDisabled={true}
                                            skinTonesDisabled={true}
                                            width={350}
                                            height={350}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Actions Footer */}
                            <div className="flex items-center justify-between mt-2 pt-1 gap-3">
                                <button
                                    onClick={handleCancelMedia}
                                    className="text-[#8696a0] font-medium text-[15px] hover:text-[#e9edef] hover:bg-[#202c33] px-5 py-2.5 rounded-xl transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleSendMedia}
                                    className="bg-[#00a884] cursor-pointer hover:bg-[#02b992] text-[#111b21] font-semibold text-[15px] px-8 py-2.5 rounded-xl transition-all flex items-center gap-2 active:scale-95"
                                >
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                    </svg>
                                    Envoyer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Input */}
            <footer className="bg-[#0b141a] px-4 py-3 flex items-end gap-3 w-full min-h-[70px]">

                <div className="flex items-center gap-1 mb-1.5 flex-shrink-0">
                    {/* Attachment Button */}
                    <button
                        onClick={handleAttachClick}
                        disabled={isUploading || !selectedPeer}
                        className={`text-[#8696a0] p-2 rounded-full transition-all ${selectedPeer && !isUploading
                            ? "hover:text-[#d1d7db] hover:bg-[#2a3942]"
                            : "opacity-50 cursor-not-allowed"
                            }`}
                        title="Joindre une image"
                    >
                        {isUploading ? (
                            <svg className="animate-spin" viewBox="0 0 24 24" height="24" width="24">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 70" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor">
                                <path d="M20.003 10.895v6.368A1.734 1.734 0 0118.268 19H5.732A1.734 1.734 0 014 17.263v-6.368A1.734 1.734 0 015.732 9h1.366a1.734 1.734 0 011.366 1.366v2.439l3.317-3.317a1.734 1.734 0 012.366 0l2.622 2.622a1.732 1.734 0 012.366 0L19 9.268A1.734 1.734 0 0120.003 10.895zM12 16.732a4.634 4.634 0 100-9.268 4.634 4.634 0 000 9.268z" />
                                <path d="M12 16.732v-4.634m0 4.634v-2.317" />
                            </svg>
                        )}
                    </button>

                    {/* Emoji Button */}
                    <button
                        onClick={() => setShowPicker(!showPicker)}
                        className="text-[#8696a0] hover:text-[#d1d7db] p-2 rounded-full hover:bg-[#2a3942] transition-all"
                    >
                        <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor">
                            <path d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363 1.108s-.669 1.959-5.051 1.959c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z" />
                        </svg>
                    </button>
                </div>

                {/* Emoji Picker for Main Input */}
                {showPicker && !mediaPreview && (
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

                {/* Text Input */}
                <div className="flex-1 bg-[#2a3942] rounded-2xl relative px-5 py-2.5 mb-1 flex items-center min-h-[46px] shadow-sm transition-all focus-within:bg-[#32404b]">
                    <input
                        type="text"
                        placeholder="Taper un message"
                        className="w-full bg-transparent text-[#d1d7db] placeholder-[#8696a0] outline-none text-[15px]"
                        value={inputValue}
                        onChange={handleChange}
                        onKeyDown={(e) => e.key === "Enter" && handleSendText()}
                    />
                </div>

            </footer>
        </div>
    );
};

export default MessageInput;