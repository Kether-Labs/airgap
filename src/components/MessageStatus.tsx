import { MessageType } from "../App";

const MessageStatus: React.FC<{ status?: MessageType["status"] }> = ({ status }) => {
    if (!status || status === "sending") {
        // Horloge — en cours d'envoi
        return (
            <span className="inline-flex items-center ml-1" title="Envoi en cours">
                <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="#8696a0" strokeWidth="1.5" />
                    <path d="M6 3.5V6L7.5 7.5" stroke="#8696a0" strokeWidth="1.5"
                        strokeLinecap="round" />
                </svg>
            </span>
        );
    }

    if (status === "failed") {
        // Croix rouge — échec
        return (
            <span className="inline-flex items-center ml-1" title="Échec d'envoi">
                <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="#ef4444" strokeWidth="1.5" />
                    <path d="M4 4L8 8M8 4L4 8" stroke="#ef4444" strokeWidth="1.5"
                        strokeLinecap="round" />
                </svg>
            </span>
        );
    }

    if (status === "delivered") {
        // Double coche bleue
        return (
            <span className="inline-flex items-center ml-1" title="Délivré">
                <svg viewBox="0 0 16 11" width="16" height="11" fill="none">
                    <path d="M1 5.5L4.5 9 9 2" stroke="#53bdeb" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 5.5L8.5 9 15 2" stroke="#53bdeb" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );
    }

    // "sent" — simple coche grise
    return (
        <span className="inline-flex items-center ml-1" title="Envoyé">
            <svg viewBox="0 0 10 11" width="10" height="11" fill="none">
                <path d="M1.5 5.5L4 8.5 8.5 2" stroke="#8696a0" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </span>
    );
};

export default MessageStatus;
