import React, { useState } from "react";
import logo from "../assets/logo.png";

interface SidebarProps {
    peers: { ip: string; name: string }[];
    selectedPeer: string | null;
    setSelectedPeer: (ip: string) => void;
    username: string;
    onUpdateUsername: (name: string) => void;
    conflictPeers: Record<string, string>;
}

const Sidebar: React.FC<SidebarProps> = ({ peers, selectedPeer, setSelectedPeer, username, onUpdateUsername, conflictPeers }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(username);

    const handleSaveName = () => {
        if (tempName.trim() && tempName !== username) {
            onUpdateUsername(tempName.trim());
        }
        setIsEditingName(false);
    };

    return (
        <aside className="w-[30%] min-w-[320px] max-w-[450px] flex flex-col border-r border-[#202c33]/50 bg-gradient-to-b from-[#111b21] to-[#0b141a] relative overflow-hidden h-full">

            {/* Background Accent / Glowing effect */}
            <div className="absolute -top-10 -left-10 w-48 h-48 bg-[#00a884]/10 blur-[80px] rounded-full pointer-events-none" />

            {/* HEADER / BRANDING AREA */}
            <div className="h-[70px] px-6 flex items-center justify-between border-b border-[#202c33]/20 backdrop-blur-xl relative z-20">
                <div className="flex items-center gap-3 group">
                    <div className="relative">
                        <div className="absolute inset-0 bg-[#00a884]/20 blur-lg rounded-full scale-125 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <img src={logo} alt="AirGap" className="w-14 h-14 object-contain relative transition-transform duration-500 group-hover:rotate-12" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">AirGap</span>
                </div>
                <div className="text-[#8696a0] hover:text-[#00a884] transition-colors cursor-pointer">
                    <svg viewBox="0 0 24 24" height="22" width="22" fill="currentColor"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"></path></svg>
                </div>
            </div>

            {/* MON PROFIL - Refined & Unique */}
            <div className="px-6 py-8 relative z-10">
                <div className=" p-4 rounded-3xl backdrop-blur-md shadow-lg group hover:bg-[#202c33]/40 transition-all duration-300">
                    <div className="flex items-center gap-4">
                        <div className="relative cursor-pointer" onClick={() => { setIsEditingName(true); setTempName(username); }}>
                            <div className="w-16 h-16 rounded-[22px] bg-gradient-to-tr from-[#00a884] to-[#53bdeb] p-[2px] shadow-xl transition-transform group-hover:scale-105 active:scale-95 rotate-3 group-hover:rotate-0 duration-500">
                                <div className="w-full h-full rounded-[20px] bg-[#111b21] flex items-center justify-center text-white font-bold text-2xl overflow-hidden shadow-inner">
                                    {username.charAt(0).toUpperCase()}
                                </div>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#00a884] border-[3px] border-[#111b21] rounded-full shadow-lg" />
                        </div>

                        <div className="flex-1 min-w-0">
                            {isEditingName ? (
                                <div className="animate-in fade-in slide-in-from-left-2">
                                    <input
                                        autoFocus
                                        className="bg-[#2a3942] text-white text-base font-bold px-3 py-1.5 rounded-xl outline-none border border-[#00a884]/50 w-full shadow-lg"
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                        onBlur={handleSaveName}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                    />
                                </div>
                            ) : (
                                <div
                                    className="flex flex-col cursor-pointer group/name"
                                    onClick={() => { setIsEditingName(true); setTempName(username); }}
                                >
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-[#e9edef] font-bold text-lg truncate group-hover/name:text-[#00a884] transition-colors">{username}</h2>
                                        <svg className="text-[#8696a0] opacity-0 group-hover/name:opacity-100 transition-opacity" viewBox="0 0 24 24" height="14" width="14" fill="currentColor"><path d="M3.95 16.7L4 16l4.5-4.5 4.4 4.5L12 17l-8.05-.3zM15.5 2l5 5-9.5 9.5-5-5L15.5 2z"></path></svg>
                                    </div>
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#00a884]/60">Mon Profil Sec</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* SEARCH AREA - Stylized Modern */}
            <div className="px-6 pb-6">
                <div className="bg-[#111b21] border border-[#202c33]/50 rounded-2xl flex items-center px-4 h-12 transition-all focus-within:ring-2 focus-within:ring-[#00a884]/20 focus-within:border-[#00a884]/40 shadow-inner">
                    <svg viewBox="0 0 24 24" height="20" width="20" className="text-[#46535d]" fill="currentColor"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.608 0a3.606 3.606 0 1 1 0-7.212 3.606 3.606 0 0 1 0 7.212z"></path></svg>
                    <input
                        type="text"
                        placeholder="Rechercher un pair..."
                        className="bg-transparent border-none text-[#d1d7db] text-sm ml-3 focus:outline-none w-full placeholder-[#46535d] font-medium"
                    />
                </div>
            </div>

            {/* CONTACT LIST BOX */}
            <div className="flex-1 overflow-hidden flex flex-col bg-[#0b141a]/50 rounded-t-[40px] border-t border-white/5 pt-8 shadow-2xl relative z-10">
                <div className="px-8 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse"></div>
                        <span className="text-xs font-bold text-[#e9edef] uppercase tracking-[0.2em]">Pairs Locaux</span>
                    </div>
                    <span className="text-[#00a884] text-[10px] font-black bg-[#00a884]/10 px-2.5 py-1 rounded-lg">
                        {peers.length} ACTIFS
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-10 space-y-2">
                    {peers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                            <div className="w-16 h-16 rounded-3xl border-2 border-dashed border-[#202c33] flex items-center justify-center mb-6 transition-transform animate-spin-slow">
                                <div className="w-3 h-3 bg-[#00a884] rounded-full animate-ping shadow-[0_0_10px_#00a884]" />
                            </div>
                            <p className="text-[#46535d] text-[14px] font-medium leading-relaxed">
                                Analyse du spectre local en cours...
                            </p>
                        </div>
                    ) : (
                        peers.map((peer) => {
                            const isConflict = conflictPeers[peer.ip] !== undefined;
                            const isSelected = selectedPeer === peer.ip;

                            return (
                                <div
                                    key={peer.ip}
                                    onClick={() => setSelectedPeer(peer.ip)}
                                    className={`group flex items-center gap-4 px-4 py-4 cursor-pointer rounded-[24px] transition-all duration-500 relative overflow-hidden
                                        ${isSelected ? 'bg-gradient-to-r from-[#00a884]/20 to-transparent border border-[#00a884]/20' : 'hover:bg-[#202c33]/20 border border-transparent'}
                                    `}
                                >
                                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00a884] rounded-r-full shadow-[0_0_15px_#00a884]"></div>}

                                    {/* Avatar with dynamic shape */}
                                    <div className="relative flex-shrink-0">
                                        <div className={`w-14 h-14 rounded-2xl bg-[#202c33] flex items-center justify-center text-white font-black text-xl shadow-lg transition-transform duration-500 group-hover:scale-105 group-hover:shadow-[#00a884]/5
                                            ${isSelected ? 'shadow-[#00a884]/10 group-hover:rotate-0' : '-rotate-1 group-hover:rotate-0'}`}>
                                            {peer.name.charAt(0).toUpperCase()}
                                        </div>
                                        {/* Conflict Badge */}
                                        {isConflict ? (
                                            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-amber-500 rounded-xl flex items-center justify-center text-[11px] font-black text-black shadow-lg border-2 border-[#111b21] animate-bounce">
                                                !
                                            </div>
                                        ) : (
                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#00a884] border-[3px] border-[#111b21] rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-[16px] font-bold truncate transition-colors ${isSelected ? 'text-white' : 'text-[#e9edef] group-hover:text-white'}`}>
                                                {peer.name}
                                            </span>
                                            {isConflict && <span className="text-amber-400 text-[9px] font-black uppercase tracking-tighter ml-1">Conflit</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#00a884] animate-pulse' : 'bg-[#46535d]'}`}></div>
                                            <span className="text-[#46535d] text-[12px] font-medium truncate italic">{peer.ip}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 12s linear infinite;
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 168, 132, 0.1); border-radius: 10px; }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0, 168, 132, 0.3); }
            `}</style>
        </aside>
    );
};

export default Sidebar;
