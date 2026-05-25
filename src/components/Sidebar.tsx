import React, { useState } from "react";
import logo from "../assets/logo.png";

interface PeerItemProps {
    peer: { ip: string; name: string };
    isOnline: boolean;
    isSelected: boolean;
    hasConflict: boolean;
    unreadCount: number;
    onClick: () => void;
}

const PeerItem: React.FC<PeerItemProps> = ({ peer, isOnline, isSelected, hasConflict, unreadCount, onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`group flex items-center gap-4 px-4 py-3 cursor-pointer rounded-2xl transition-all duration-300 relative overflow-hidden
                ${isSelected ? 'bg-aurora-accent/20 border border-aurora-accent/30 shadow-lg shadow-aurora-accent/5' : 'hover:bg-white/5 border border-transparent'}
                ${!isOnline ? 'opacity-50 hover:opacity-100' : ''}
            `}
        >
            {/* Selection Indicator */}
            {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-aurora-accent rounded-r-full shadow-[0_0_12px_rgba(99,102,241,0.8)]"></div>}

            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg transition-all duration-300 group-hover:scale-105
                    ${isSelected ? 'bg-aurora-accent ring-2 ring-aurora-accent/20' : 'bg-zinc-800'}
                    ${!isOnline ? 'grayscale' : ''}
                `}>
                    {peer.name.charAt(0).toUpperCase()}
                </div>
                
                {/* Status Indicator */}
                {hasConflict ? (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-[10px] font-black text-black shadow-lg border-2 border-zinc-900 animate-pulse">
                        !
                    </div>
                ) : (
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-zinc-900 rounded-full shadow-sm transition-all
                        ${isOnline ? 'bg-aurora-accent animate-pulse' : 'bg-zinc-600'}
                    `} />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-[15px] font-semibold truncate transition-colors ${isSelected ? 'text-white' : 'text-zinc-200 group-hover:text-white'}`}>
                        {peer.name}
                    </span>
                    {unreadCount > 0 && (
                        <div className="min-w-[18px] h-[18px] px-1 bg-aurora-accent rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 text-[11px] font-medium truncate">{peer.ip}</span>
                </div>
            </div>
        </div>
    );
};

interface SidebarProps {
    peers: { ip: string; name: string }[];
    selectedPeer: string | null;
    setSelectedPeer: (ip: string) => void;
    username: string;
    onUpdateUsername: (name: string) => void;
    conflictPeers: Record<string, string>;
    activePeerIps: string[];
    unreadCounts: Record<string, number>;
}

const Sidebar: React.FC<SidebarProps> = ({ peers, selectedPeer, setSelectedPeer, username, onUpdateUsername, conflictPeers, activePeerIps, unreadCounts }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(username);

    const onlinePeers = peers.filter(p => activePeerIps.includes(p.ip));
    const offlinePeers = peers.filter(p => !activePeerIps.includes(p.ip));

    const handleSaveName = () => {
        if (tempName.trim() && tempName !== username) {
            onUpdateUsername(tempName.trim());
        }
        setIsEditingName(false);
    };

    return (
        <aside className="w-[320px] lg:w-[380px] flex flex-col glass-dark border-r border-aurora-border relative z-30 h-full">

            {/* BRANDING AREA */}
            <div className="px-6 py-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-aurora-accent/10 rounded-xl flex items-center justify-center border border-aurora-accent/20">
                        <img src={logo} alt="AirGap" className="w-7 h-7 object-contain" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">AirGap</span>
                </div>
                <div className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-2 hover:bg-white/5 rounded-lg">
                    <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"></path></svg>
                </div>
            </div>

            {/* MY PROFILE - Refined Glass Look */}
            <div className="px-6 mb-6">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="relative cursor-pointer group" onClick={() => { setIsEditingName(true); setTempName(username); }}>
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-aurora-accent to-aurora-secondary p-[1px] shadow-lg transition-transform group-hover:scale-105 active:scale-95 duration-300">
                                <div className="w-full h-full rounded-[11px] bg-zinc-900 flex items-center justify-center text-white font-bold text-xl">
                                    {username.charAt(0).toUpperCase()}
                                </div>
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-aurora-accent border-2 border-zinc-900 rounded-full shadow-sm" />
                        </div>

                        <div className="flex-1 min-w-0">
                            {isEditingName ? (
                                <input
                                    autoFocus
                                    className="bg-zinc-800 text-white text-sm font-semibold px-3 py-1.5 rounded-lg outline-none border border-aurora-accent/50 w-full"
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    onBlur={handleSaveName}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                />
                            ) : (
                                <div
                                    className="flex flex-col cursor-pointer group/name"
                                    onClick={() => { setIsEditingName(true); setTempName(username); }}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <h2 className="text-zinc-100 font-bold text-base truncate group-hover/name:text-aurora-accent transition-colors">{username}</h2>
                                        <svg className="text-zinc-500 opacity-0 group-hover/name:opacity-100 transition-opacity" viewBox="0 0 24 24" height="12" width="12" fill="currentColor"><path d="M3.95 16.7L4 16l4.5-4.5 4.4 4.5L12 17l-8.05-.3zM15.5 2l5 5-9.5 9.5-5-5L15.5 2z"></path></svg>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-aurora-accent/70">Connecté</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* SEARCH */}
            <div className="px-6 pb-6">
                <div className="bg-white/5 border border-white/5 rounded-xl flex items-center px-4 h-11 transition-all focus-within:ring-2 focus-within:ring-aurora-accent/20 focus-within:border-aurora-accent/40">
                    <svg viewBox="0 0 24 24" height="18" width="18" className="text-zinc-500" fill="currentColor"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.608 0a3.606 3.606 0 1 1 0-7.212 3.606 3.606 0 0 1 0 7.212z"></path></svg>
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        className="bg-transparent border-none text-zinc-200 text-sm ml-3 focus:outline-none w-full placeholder-zinc-600 font-medium"
                    />
                </div>
            </div>

            {/* CONTACT LIST */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-6 space-y-1">
                {peers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                        <div className="w-12 h-12 rounded-xl border border-zinc-800 flex items-center justify-center mb-4 animate-pulse">
                            <div className="w-2 h-2 bg-aurora-accent rounded-full" />
                        </div>
                        <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
                            Recherche de pairs...
                        </p>
                    </div>
                ) : (
                    <>
                        {onlinePeers.length > 0 && (
                            <>
                                <div className="text-zinc-500 text-[10px] font-bold px-4 py-2 uppercase tracking-widest">
                                    En ligne — {onlinePeers.length}
                                </div>
                                {onlinePeers.map((peer) => (
                                    <PeerItem
                                        key={peer.ip}
                                        unreadCount={unreadCounts[peer.ip] || 0}
                                        peer={peer}
                                        isOnline={true}
                                        isSelected={selectedPeer === peer.ip}
                                        hasConflict={!!conflictPeers[peer.ip]}
                                        onClick={() => setSelectedPeer(peer.ip)}
                                    />
                                ))}
                            </>
                        )}

                        {offlinePeers.length > 0 && (
                            <>
                                <div className="text-zinc-500 text-[10px] font-bold px-4 py-2 mt-4 uppercase tracking-widest">
                                    Hors ligne — {offlinePeers.length}
                                </div>
                                {offlinePeers.map((peer) => (
                                    <PeerItem
                                        key={peer.ip}
                                        peer={peer}
                                        unreadCount={unreadCounts[peer.ip] || 0}
                                        isOnline={false}
                                        isSelected={selectedPeer === peer.ip}
                                        hasConflict={!!conflictPeers[peer.ip]}
                                        onClick={() => setSelectedPeer(peer.ip)}
                                    />
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
