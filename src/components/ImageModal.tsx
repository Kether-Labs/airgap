import React from "react";

interface ImageModalProps {
    imageUrl: string;
    onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose }) => {
    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-500 px-4 py-8"
            onClick={onClose}
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-8 right-8 p-3 text-white/40 hover:text-white hover:bg-white/10 rounded-2xl transition-all duration-300"
            >
                <svg viewBox="0 0 24 24" height="32" width="32" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"></path></svg>
            </button>

            {/* Image Container */}
            <div
                className="relative max-w-full max-h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={imageUrl}
                    alt="Preview"
                    className="max-w-full max-h-[80vh] rounded-[32px] shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 object-contain"
                />

                <div className="mt-10 flex gap-6">
                    <a
                        href={imageUrl}
                        download="airgap_image.jpg"
                        className="bg-white/5 hover:bg-white/10 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-3 backdrop-blur-md border border-white/5 shadow-xl active:scale-95"
                    >
                        <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path></svg>
                        Télécharger
                    </a>
                    <button
                        onClick={onClose}
                        className="bg-aurora-accent hover:bg-aurora-accent-hover text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-aurora-accent/20 active:scale-95"
                    >
                        Fermer l'aperçu
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageModal;
