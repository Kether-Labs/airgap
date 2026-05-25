import React, { useState, useRef, useCallback } from "react";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { invoke } from "@tauri-apps/api/core";

interface MediaPreview {
    path: string;
    base64: string;
    type: string;
    name: string;
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
                    name: 'Fichiers',
                    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx']
                }]
            });

            if (selected) {
                setIsUploading(true);
                const filePath = selected as string;
                const fileName = filePath.split(/[/\\]/).pop() || "fichier";
                const extension = fileName.split('.').pop()?.toLowerCase() || "";

                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension);
                const type = isImage ? "image" : "document";

                try {
                    const fileData = await readFile(filePath);
                    const base64 = btoa(
                        new Uint8Array(fileData).reduce((data, byte) => data + String.fromCharCode(byte), '')
                    );
                    setMediaPreview({ path: filePath, base64, type, name: fileName });
                } catch {
                    setMediaPreview({ path: filePath, base64: "", type, name: fileName });
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
            type: mediaPreview.type,
            base64: mediaPreview.base64,
            caption: inputValue.trim() || (mediaPreview.type === "document" ? mediaPreview.name : undefined)
        });
        setMediaPreview(null);
        setInputValue("");
    };

    const handleCancelMedia = () => {
        setMediaPreview(null);
    };

    return (
        <div className="relative z-30 w-full px-6 pb-6">
            {/* Media Preview Modal */}
            {mediaPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-zinc-900 w-[500px] max-w-[95vw] rounded-[32px] shadow-2xl overflow-hidden border border-white/5 animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-6">
                            <h2 className="text-white text-xl font-bold">Partager l'image</h2>
                            <button
                                onClick={handleCancelMedia}
                                className="text-zinc-500 hover:text-white hover:bg-white/5 p-2 rounded-xl transition-all"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                            </button>
                        </div>

                        {/* Image Preview Area */}
                        <div className="relative w-full max-h-[400px] bg-black/40 flex items-center justify-center p-4 border-y border-white/5">
                            {mediaPreview.type === "image" ? (
                                mediaPreview.base64 ? (
                                    <img
                                        src={`data:image/jpeg;base64,${mediaPreview.base64}`}
                                        alt="Aperçu"
                                        className="max-h-[380px] max-w-full rounded-2xl shadow-xl object-contain"
                                    />
                                ) : (
                                    <div className="h-[200px] flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-xs">
                                        Chargement...
                                    </div>
                                )
                            ) : (
                                <div className="h-[200px] flex flex-col items-center justify-center gap-4">
                                    <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                                        <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" className="text-aurora-accent">
                                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                                        </svg>
                                    </div>
                                    <span className="text-white font-bold text-sm truncate max-w-[300px]">{mediaPreview.name}</span>
                                </div>
                            )}
                        </div>

                        {/* Options / Footer Section */}
                        <div className="px-8 py-6 flex flex-col gap-6">
                            {/* Caption Input */}
                            <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-5 py-3 border border-transparent focus-within:border-aurora-accent/40 transition-all">
                                <input
                                    type="text"
                                    placeholder="Ajouter une légende..."
                                    className="w-full bg-transparent text-white placeholder-zinc-500 outline-none text-[15px] font-medium"
                                    value={inputValue}
                                    onChange={handleChange}
                                    onKeyDown={(e) => e.key === "Enter" && handleSendMedia()}
                                />
                                <button
                                    onClick={() => setShowPicker(!showPicker)}
                                    className={`${showPicker ? 'text-aurora-accent' : 'text-zinc-500'} hover:text-aurora-accent transition-colors`}
                                >
                                    <svg viewBox="0 0 24 24" height="22" width="22" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5s.67 1.5 1.5 1.5zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                                    </svg>
                                </button>
                            </div>

                            {/* Actions Footer */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleCancelMedia}
                                    className="flex-1 text-zinc-400 font-bold text-sm uppercase tracking-widest hover:text-white hover:bg-white/5 py-4 rounded-2xl transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleSendMedia}
                                    className="flex-[2] bg-aurora-accent hover:bg-indigo-500 text-white font-bold text-sm uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-aurora-accent/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Envoyer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Input Bar */}
            <footer className="glass rounded-[24px] px-2 py-2 flex items-center gap-2 shadow-2xl">
                <div className="flex items-center">
                    {/* Attachment Button */}
                    <button
                        onClick={handleAttachClick}
                        disabled={isUploading || !selectedPeer}
                        className={`p-3 rounded-xl transition-all ${selectedPeer && !isUploading
                            ? "text-zinc-400 hover:text-white hover:bg-white/5"
                            : "opacity-30 cursor-not-allowed"
                            }`}
                    >
                        {isUploading ? (
                            <div className="w-5 h-5 border-2 border-aurora-accent border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg viewBox="0 0 24 24" height="22" width="22" fill="currentColor">
                                <path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z" />
                            </svg>
                        )}
                    </button>

                    {/* Emoji Button */}
                    <button
                        onClick={() => setShowPicker(!showPicker)}
                        className={`p-3 rounded-xl transition-all ${showPicker ? 'text-aurora-accent bg-aurora-accent/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <svg viewBox="0 0 24 24" height="22" width="22" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5s.67 1.5 1.5 1.5zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                        </svg>
                    </button>
                </div>

                {/* Emoji Picker for Main Input */}
                {showPicker && !mediaPreview && (
                    <div className="absolute bottom-[100px] left-6 shadow-2xl rounded-3xl overflow-hidden border border-white/5 animate-in slide-in-from-bottom-4 duration-300">
                        <EmojiPicker
                            theme={Theme.DARK}
                            onEmojiClick={handleEmojiClick}
                            searchDisabled={true}
                            skinTonesDisabled={true}
                            width={320}
                            height={400}
                        />
                    </div>
                )}

                {/* Text Input */}
                <div className="flex-1 flex items-center h-12">
                    <input
                        type="text"
                        placeholder="Écrire un message..."
                        className="w-full bg-transparent text-white placeholder-zinc-500 outline-none text-base font-medium px-2"
                        value={inputValue}
                        onChange={handleChange}
                        onKeyDown={(e) => e.key === "Enter" && handleSendText()}
                    />
                </div>

                {/* Send Button */}
                <button
                    onClick={handleSendText}
                    disabled={!inputValue.trim()}
                    className={`h-11 w-11 flex items-center justify-center rounded-2xl transition-all duration-300 active:scale-90
                        ${inputValue.trim()
                            ? "bg-aurora-accent text-white shadow-lg shadow-aurora-accent/20"
                            : "bg-white/5 text-zinc-600 cursor-not-allowed"}
                    `}
                >
                    <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor" className={inputValue.trim() ? "translate-x-0.5" : ""}>
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                </button>
            </footer>
        </div>
    );
};

export default MessageInput;