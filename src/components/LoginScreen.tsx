import React, { useState } from "react";

interface LoginScreenProps {
    onLogin: (username: string) => Promise<void>;
    isSystemReady: boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, isSystemReady }) => {
    const [inputName, setInputName] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (inputName.trim() === "") return;
        setIsLoading(true);
        await onLogin(inputName);
        setIsLoading(false);
    };

    if (!isSystemReady) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0b141a] text-[#8696a0]">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-[#00a884] rounded-full" role="status"></div>
                    <p className="text-sm font-medium">Initialisation du réseau AirGap...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen items-center justify-center bg-[#0b141a] text-[#e9edef] font-sans selection:bg-[#00a884]/30">

            {/* Bandeau vert style WhatsApp en arrière-plan */}
            <div className="absolute top-0 left-0 w-full h-[222px] bg-[#00a884] z-0"></div>

            <div className="relative z-10 bg-[#111b21] p-10 rounded-xl shadow-[0_17px_50px_0_rgba(11,20,26,.19),0_12px_15px_0_rgba(11,20,26,.24)] w-full max-w-md border border-[#202c33]">

                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-[#202c33] rounded-full flex items-center justify-center mb-4 text-[#00a884]">
                        <svg viewBox="0 0 24 24" height="32" width="32" preserveAspectRatio="xMidYMid meet" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"></path></svg>
                    </div>
                    <h1 className="text-2xl font-light text-[#e9edef] text-center">Bienvenue sur AirGap</h1>
                    <p className="text-[#8696a0] mt-2 text-sm text-center">Communication locale sécurisée hors-ligne.</p>
                </div>

                <div className="space-y-6">
                    <div className="relative">
                        <input
                            type="text"
                            className="w-full bg-transparent border-b-2 border-[#8696a0] text-[#d1d7db] px-2 py-3 focus:outline-none focus:border-[#00a884] transition-colors peer"
                            placeholder=" "
                            value={inputName}
                            onChange={(e) => setInputName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            maxLength={25}
                        />
                        <label className="absolute left-2 top-3 text-[#8696a0] pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-xs peer-focus:text-[#00a884] peer-active:-top-4 peer-active:text-xs peer-active:text-[#00a884]">
                            {inputName ? "" : "Entrez votre pseudonyme"}
                        </label>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!inputName.trim() || isLoading}
                        className="w-full bg-[#00a884] hover:bg-[#00c298] text-[#111b21] font-medium py-3 rounded shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                        {isLoading ? (
                            <div className="animate-spin inline-block w-5 h-5 border-[2px] border-current border-t-transparent rounded-full" role="status"></div>
                        ) : (
                            "Suivant"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
