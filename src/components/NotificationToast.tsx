import React, { useEffect, useState } from "react";

export interface ToastProps {
    id: string;
    peerIp: string;
    name: string;
    content: string;
    onClose: (id: string) => void;
    onClick: (peerIp: string) => void;
}

const NotificationToast: React.FC<ToastProps> = ({
    id,
    peerIp,
    name,
    content,
    onClose,
    onClick,
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Declenche l'animation d'entrée
        requestAnimationFrame(() => setIsVisible(true));

        // Auto-dismiss après 4 secondes
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onClose(id), 300); // Attend la fin de l'animation de sortie
        }, 4000);

        return () => clearTimeout(timer);
    }, [id, onClose]);

    return (
        <div
            onClick={() => onClick(peerIp)}
            className={`w-full p-3 rounded-2xl cursor-pointer shadow-2xl transition-all duration-300 ease-in-out border border-white/5 hover:bg-white/10 glass-dark flex items-center gap-3
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}
      `}
        >
            <div className="w-10 h-10 rounded-xl bg-aurora-accent flex items-center justify-center flex-shrink-0 shadow-lg shadow-aurora-accent/20">
                <span className="text-white font-bold text-lg">
                    {name.charAt(0).toUpperCase()}
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-[14px] truncate">{name}</h4>
                <p className="text-zinc-400 text-[12px] truncate mt-0.5">{content}</p>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsVisible(false);
                    setTimeout(() => onClose(id), 300);
                }}
                className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
            </button>
        </div>
    );
};

export default NotificationToast;
