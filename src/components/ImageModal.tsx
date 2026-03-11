import React from "react";

interface ImageModalProps {
    imageUrl: string;
    onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose }) => {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300 px-4 py-8"
            onClick={onClose}
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors hover:rotate-90 duration-300"
            >
                <svg viewBox="0 0 24 24" height="32" width="32" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"></path></svg>
            </button>

            {/* Image Container */}
            <div
                className="relative max-w-full max-h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={imageUrl}
                    alt="Preview"
                    className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-white/10"
                />

                <div className="mt-6 flex gap-4">
                    <a
                        href={imageUrl}
                        download="airgap_image.jpg"
                        className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-full font-medium transition-all flex items-center gap-2 backdrop-blur-md border border-white/5 shadow-lg"
                    >
                        <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path></svg>
                        Télécharger
                    </a>
                    <button
                        onClick={onClose}
                        className="bg-[#00a884] hover:bg-[#00c298] text-[#111b21] px-6 py-2.5 rounded-full font-bold transition-all shadow-lg shadow-[#00a884]/20 active:scale-95"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageModal;
