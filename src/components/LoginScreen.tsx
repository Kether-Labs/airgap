import React, { useState } from "react";
import logo from "../assets/logo.png";

interface LoginScreenProps {
    onLogin: (username: string) => Promise<void>;
    isSystemReady: boolean;
    isChecking: boolean;
    error: string | null;
    usernameConflictAlert: boolean;
    onClearError: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, isSystemReady, usernameConflictAlert, isChecking, error, onClearError }) => {
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
                <div className="flex flex-col items-center gap-6 animate-pulse">
                    <img src={logo} alt="AirGap Logo" className="w-20 h-20 opacity-50 grayscale" />
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin inline-block w-6 h-6 border-[2px] border-current border-t-transparent text-[#00a884] rounded-full" role="status"></div>
                        <p className="text-sm font-medium tracking-wide">Initialisation du réseau local...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen items-center justify-center bg-[#0b141a] text-[#e9edef] font-sans selection:bg-[#00a884]/30 relative overflow-hidden">

            {/* Background Decorative Elements */}
            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#00a884]/5 blur-[120px] rounded-full"></div>
            <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-[#53bdeb]/5 blur-[120px] rounded-full"></div>

            {/* WhatsApp Brand Header (Subtle) */}
            <div className="absolute top-0 left-0 w-full h-[222px] bg-gradient-to-b from-[#00a884]/20 to-transparent z-0"></div>

            <div className="relative z-10 w-full max-w-md px-6 animate-in fade-in zoom-in-95 duration-700">
                <div className="bg-[#111b21]/80 backdrop-blur-xl p-10 rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-white/5 flex flex-col items-center">

                    {/* Logo Section */}
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-[#00a884]/20 blur-2xl rounded-full scale-150"></div>
                        <div className="relative w-24 h-24 bg-[#202c33] rounded-3xl flex items-center justify-center shadow-2xl overflow-hidden group">
                            <img src={logo} alt="AirGap" className="w-96 h-96 object-contain group-hover:scale-110 transition-transform duration-500" />
                        </div>
                    </div>

                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">AirGap</h1>
                        <p className="text-[#8696a0] text-[15px] leading-relaxed max-w-[240px] mx-auto font-medium">
                            Votre canal de communication <span className="text-[#00a884]">local et sécurisé</span>.
                        </p>
                    </div>

                    <div className="w-full space-y-8">
                        {usernameConflictAlert && (
                            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-[#202c33] text-[#8696a0] text-xs px-3 py-1 rounded-full shadow">
                                Le nom d'utilisateur "{inputName}" est déjà utilisé par quelqu'un sur ce réseau. Choisis un autre pseudo.
                            </div>
                        )}
                        <div className="relative group">
                            <input
                                type="text"
                                className="w-full bg-[#202c33]/40 border border-[#2a3942] rounded-2xl text-[#d1d7db] px-5 py-4 focus:outline-none focus:border-[#00a884] focus:ring-4 focus:ring-[#00a884]/10 transition-all placeholder:text-transparent peer text-lg shadow-inner"
                                placeholder="Pseudonyme"
                                id="username"
                                value={inputName}
                                onChange={(e) => { setInputName(e.target.value); if (error) onClearError(); }}
                                onKeyDown={(e) => e.key === "Enter" && !isChecking && handleSubmit()}
                                maxLength={25}
                                autoComplete="off"
                            />
                            <label
                                htmlFor="username"
                                className="absolute left-5 top-4 text-[#8696a0] pointer-events-none transition-all peer-focus:-top-2.5 peer-focus:left-4 peer-focus:text-xs peer-focus:text-[#00a884] peer-focus:bg-[#111b21] peer-focus:px-2 rounded-md
                                ${inputName ? '-top-2.5 left-4 text-xs bg-[#111b21] px-2' : ''}"
                            >
                                Entrez votre pseudonyme
                            </label>

                            <div className="absolute right-4 top-4.5 text-[11px] font-bold text-[#46535d] opacity-50">
                                {inputName.length}/25
                            </div>
                        </div>
                        {error && (
                            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30
                            text-red-400 text-sm px-4 py-3 rounded-xl">
                                <span className="text-base leading-none mt-0.5">⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}
                        <button
                            onClick={handleSubmit}
                            disabled={!inputName.trim() || isLoading || isChecking}
                            className="w-full bg-[#00a884] hover:bg-[#00c298] disabled:bg-[#2a3942] text-[#111b21] font-bold py-4 rounded-2xl shadow-lg shadow-[#00a884]/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 group overflow-hidden relative"
                        >
                            <span className="relative z-10">Démarrer l'aventure</span>
                            {isLoading ? (
                                <div className="animate-spin inline-block w-5 h-5 border-[2px] border-current border-t-transparent rounded-full" role="status"></div>
                            ) : (
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                            )}
                            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none"></div>
                        </button>
                    </div>
                    {isChecking && (
                        <p className="text-[#8696a0] text-xs text-center animate-pulse">
                            Recherche de conflits sur le réseau…
                        </p>
                    )}
                    <div className="mt-8 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00a884]"></div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#46535d]">Réseau Local Uniquement</span>
                    </div>
                </div>
            </div>

            {/* Subtle Footer Info */}
            <p className="absolute bottom-10 text-[11px] text-[#46535d] font-medium tracking-wide">
                Version 1.2.0 • Chiffrement AirGap Actif
            </p>
        </div>
    );
};

export default LoginScreen;
