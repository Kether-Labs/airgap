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
            <div className="flex h-screen items-center justify-center aurora-bg text-zinc-400">
                <div className="flex flex-col items-center gap-8">
                    <div className="relative">
                        <div className="absolute inset-0 bg-aurora-accent/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
                        <img src={logo} alt="AirGap Logo" className="w-24 h-24 relative z-10" />
                    </div>
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden relative">
                            <div className="absolute inset-0 bg-aurora-accent animate-infinite-scroll" style={{ width: '40%' }}></div>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Initialisation du spectre local</p>
                    </div>
                </div>
                <style>{`
                    @keyframes scroll {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(250%); }
                    }
                    .animate-infinite-scroll {
                        animation: scroll 1.5s infinite linear;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="flex h-screen items-center justify-center aurora-bg text-zinc-200 font-sans selection:bg-aurora-accent/30 relative overflow-hidden">

            {/* Immersive Background Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-aurora-accent/10 blur-[150px] rounded-full"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-aurora-secondary/5 blur-[150px] rounded-full"></div>

            <div className="relative z-10 w-full max-w-lg px-8 animate-in fade-in zoom-in-95 duration-1000">
                <div className="glass p-12 rounded-[40px] shadow-2xl border border-white/5 flex flex-col items-center">

                    {/* Logo Section */}
                    <div className="relative mb-10 group">
                        <div className="absolute inset-0 bg-aurora-accent/20 blur-3xl rounded-full scale-150 group-hover:scale-175 transition-transform duration-700"></div>
                        <div className="relative w-28 h-28 bg-zinc-900 rounded-[32px] flex items-center justify-center shadow-2xl border border-white/5 overflow-hidden">
                            <img src={logo} alt="AirGap" className="w-20 h-20 object-contain group-hover:scale-110 transition-transform duration-500" />
                        </div>
                    </div>

                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-black text-white mb-4 tracking-tighter">AirGap</h1>
                        <p className="text-zinc-400 text-base leading-relaxed max-w-[280px] mx-auto font-medium">
                            Messagerie décentralisée <br /> <span className="text-white">locale et sécurisée</span>.
                        </p>
                    </div>

                    <div className="w-full space-y-8">
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-aurora-accent to-aurora-secondary rounded-2xl blur opacity-0 group-focus-within:opacity-30 transition duration-500"></div>
                            <input
                                type="text"
                                className="relative w-full bg-zinc-900 border border-white/5 rounded-2xl text-white px-6 py-5 focus:outline-none transition-all placeholder:text-zinc-600 text-lg font-semibold"
                                placeholder="Choisissez un pseudonyme"
                                id="username"
                                value={inputName}
                                onChange={(e) => { setInputName(e.target.value); if (error) onClearError(); }}
                                onKeyDown={(e) => e.key === "Enter" && !isChecking && handleSubmit()}
                                maxLength={25}
                                autoComplete="off"
                            />
                            
                            <div className="absolute right-4 bottom-[-24px] text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                                {inputName.length}/25 caractères
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest px-5 py-4 rounded-2xl animate-in shake-1">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={!inputName.trim() || isLoading || isChecking}
                            className="w-full bg-white text-zinc-950 hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex justify-center items-center gap-3 group relative overflow-hidden"
                        >
                            <span className="relative z-10 uppercase tracking-widest text-sm">Démarrer l'aventure</span>
                            {isLoading || isChecking ? (
                                <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                            )}
                        </button>
                    </div>

                    <div className="mt-12 flex items-center gap-3 py-2 px-4 rounded-full bg-white/5 border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Node local actif</span>
                    </div>
                </div>
            </div>

            {/* Version Info */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
                 <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                    AirGap v1.2.0 • Chiffrement RSA-2048
                </p>
            </div>
        </div>
    );
};

export default LoginScreen;
