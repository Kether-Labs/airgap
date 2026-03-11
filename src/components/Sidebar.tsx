import React, { useState } from "react";

interface SidebarProps {
    peers: { ip: string; name: string }[];
    selectedPeer: string | null;
    setSelectedPeer: (ip: string) => void;
    username: string;
    onUpdateUsername: (name: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ peers, selectedPeer, setSelectedPeer, username, onUpdateUsername }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(username);

    const handleSaveName = () => {
        if (tempName.trim() && tempName !== username) {
            onUpdateUsername(tempName.trim());
        }
        setIsEditingName(false);
    };

    return (
        <aside className="w-[30%] min-w-[320px] max-w-[450px] flex flex-col border-r border-[#202c33]/50 bg-gradient-to-b from-[#111b21] to-[#0b141a] relative overflow-hidden">

            {/* Background Accent for Creativity */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#00a884]/5 blur-[100px] rounded-full pointer-events-none" />

            {/* MON PROFIL - Refined & Creative */}
            <div className="h-[110px] px-6 flex flex-col justify-center border-b border-[#202c33]/30 backdrop-blur-md relative z-10">
                <div className="flex items-center gap-4">
                    <div className="relative group cursor-pointer">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#00a884] to-[#53bdeb] p-[2px] shadow-lg transition-transform group-hover:scale-105 active:scale-95">
                            <div className="w-full h-full rounded-full bg-[#111b21] flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                                {username.charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#00a884] border-2 border-[#111b21] rounded-full animate-pulse" />
                    </div>

                    <div className="flex-1 min-w-0">
                        {isEditingName ? (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                <input
                                    autoFocus
                                    className="bg-[#2a3942] text-[#e9edef] text-sm font-medium px-2 py-1 rounded outline-none border border-[#00a884]/50 w-full"
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    onBlur={handleSaveName}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                />
                            </div>
                        ) : (
                            <div
                                className="group flex items-center gap-2 cursor-pointer"
                                onClick={() => { setIsEditingName(true); setTempName(username); }}
                            >
                                <h2 className="text-[#e9edef] font-semibold text-lg truncate">{username}</h2>
                                <svg className="text-[#8696a0] opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" height="14" width="14" fill="currentColor"><path d="M3.95 16.7L4 16l4.5-4.5 4.4 4.5L12 17l-8.05-.3zM15.5 2l5 5-9.5 9.5-5-5L15.5 2z"></path></svg>
                            </div>
                        )}
                        <p className="text-[#8696a0] text-xs mt-0.5 italic">"AirGap Enthusiast"</p>
                    </div>
                </div>
            </div>

            {/* SEARCH AREA - Stylized */}
            <div className="p-4">
                <div className="bg-[#202c33]/50 backdrop-blur-sm border border-[#202c33]/50 rounded-xl flex items-center px-4 h-11 transition-all focus-within:bg-[#202c33] focus-within:border-[#00a884]/30">
                    <svg viewBox="0 0 24 24" height="20" width="20" className="text-[#8696a0]" fill="currentColor"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.608 0a3.606 3.606 0 1 1 0-7.212 3.606 3.606 0 0 1 0 7.212z"></path></svg>
                    <input
                        type="text"
                        placeholder="Chercher un contact local..."
                        className="bg-transparent border-none text-[#d1d7db] text-[14px] ml-3 focus:outline-none w-full placeholder-[#46535d]"
                    />
                </div>
            </div>

            {/* LISTE DES PAIRS - Glassmorphism effects */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-1 pb-4">
                <div className="px-3 mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#00a884] uppercase tracking-wider">Contacts en ligne</span>
                    <span className="bg-[#00a884]/10 text-[#00a884] text-[10px] px-2 py-0.5 rounded-full font-bold">{peers.length}</span>
                </div>

                {peers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#202c33] flex items-center justify-center mb-4 transition-transform animate-spin-slow">
                            <div className="w-2 h-2 bg-[#00a884] rounded-full animate-ping" />
                        </div>
                        <p className="text-[#8696a0] text-[13px] leading-relaxed">
                            Nous scannons votre réseau pour trouver des amis...
                        </p>
                    </div>
                ) : (
                    peers.map((peer) => (
                        <div
                            key={peer.ip}
                            onClick={() => setSelectedPeer(peer.ip)}
                            className={`flex items-center px-3 py-3 cursor-pointer rounded-2xl transition-all duration-300 group ${selectedPeer === peer.ip ? 'bg-[#2a3942] shadow-lg ring-1 ring-[#00a884]/20' : 'hover:bg-[#202c33]/50'}`}
                        >
                            <div className="relative">
                                <div className="w-[52px] h-[52px] rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg shadow-inner ring-2 ring-transparent group-hover:ring-[#00a884]/30 transition-all">
                                    {peer.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-[#00a884] border-[3px] border-[#111b21] rounded-full group-hover:scale-110 transition-transform shadow-sm" />
                            </div>

                            <div className="ml-4 flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-[#e9edef] text-[15.5px] font-medium truncate">{peer.name}</span>
                                    <span className="text-[10px] text-[#00a884] font-bold animate-pulse">LIVE</span>
                                </div>
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <svg className="w-3 h-3 text-[#8696a0] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 21a9.99 9.99 0 0011-9.919c0-5.47-4.431-9.919-9.894-9.919a9.996 9.996 0 00-9.894 9.919 9.996 9.996 0 001.277 4.887l.054.09z"></path></svg>
                                    <p className="text-[#8696a0] text-[12px] truncate italic">Pair détecté sur {peer.ip}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <style>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
            `}</style>
        </aside>
    );
};

export default Sidebar;
