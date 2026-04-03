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
            className={`w-full p-3 rounded-2xl cursor-pointer shadow-2xl transition-all duration-300 ease-in-out border border-[#3b4a54]/50 hover:bg-[#202c33]/90 bg-[#202c33]/80 backdrop-blur-xl flex items-center gap-3
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}
      `}
        >
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#00a884] to-[#005c4b] flex items-center justify-center flex-shrink-0 shadow-inner">
                <span className="text-white font-bold text-lg">
                    {name.charAt(0).toUpperCase()}
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-[#e9edef] font-semibold text-[15px] truncate">{name}</h4>
                <p className="text-[#8696a0] text-[13px] truncate mt-0.5">{content}</p>
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsVisible(false);
                    setTimeout(() => onClose(id), 300);
                }}
                className="text-[#8696a0] hover:text-[#e9edef] p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
            </button>
        </div>
    );
};

export default NotificationToast;
