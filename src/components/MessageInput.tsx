import React, { useState, useRef } from "react";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import compressImage from "../lib/compressImage";

interface MessageInputProps {
    onSendMessage: (message: string) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage }) => {
    const [inputValue, setInputValue] = useState("");
    const [showPicker, setShowPicker] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleEmojiClick = (emojiData: any) => {
        setInputValue((prev) => prev + emojiData.emoji);
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
                    <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor"><path d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363 1.108s-.669 1.959-5.051 1.959c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z"></path></svg>
                </button>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressing}
                    className={`text-[#8696a0] hover:text-[#d1d7db] p-2 rounded-full hover:bg-[#2a3942] transition-all ${isCompressing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor"><path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 0 0 3.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.959.958 2.423 1.053 3.263.215l5.511-5.512c.28-.28.267-.722.053-.936l-.244-.244c-.191-.191-.567-.349-.957.04l-5.506 5.506c-.18.18-.635.127-.976-.214-.098-.097-.576-.613-.213-.973l7.915-7.917c.818-.818 2.268-.69 3.253.295.579.58.758 1.339.737 1.822-.014.335-.192.87-.842 1.52l-9.546 9.546a3.49 3.49 0 0 1-2.472 1.026c-1.608 0-3.001-1.282-3.27-2.831-.07-.406-.025-1.096.353-1.474l9.053-9.053c.28-.28.268-.722.053-.936l-.244-.244c-.191-.191-.567-.349-.957.04L8.134 14.74a5.58 5.58 0 0 0-1.646 3.972z"></path></svg>
                </button>
            </div>

            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageSelect}
                className="hidden"
            />

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
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                        <span>Traitement de l'image...</span>
                    </div>
                ) : (
                    <input
                        type="text"
                        placeholder="Taper un message"
                        className="w-full bg-transparent text-[#d1d7db] placeholder-[#8696a0] outline-none text-[15px]"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
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
                    <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor" className="ml-0.5"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path></svg>
                ) : (
                    <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor"><path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.349 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.237 6.002s-6.237-2.471-6.237-6.002H3.761c0 4.001 3.178 7.297 7.061 7.885v3.884h2.354v-3.884c3.884-.588 7.061-3.884 7.061-7.885h-2.001z"></path></svg>
                )}
            </button>

        </footer>
    );
};

export default MessageInput;
