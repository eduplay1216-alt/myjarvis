import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Dashboard } from '../../components/Dashboard';
import { ChatMessage } from '../../components/ChatMessage';
import { ChatInput } from '../../components/ChatInput';
import { supabase } from '/src/services/supabaseClient';

export const ChatLayout: React.FC = () => {
    const {
        transactions,
        tasks,
        dbError,
        messages,
        isLoading,
        isRecording,
        handleSendMessage,
        handleAudioUpload,
        handleToggleRecording,
        handleUpdateTask,
        handleDeleteTask,
        handleEditTask,
        handleSyncToCalendar,
        handleSyncFromCalendar,
        handleSyncAllToCalendar
    } = useAppContext();

    const [isDashboardOpen, setIsDashboardOpen] = useState<boolean>(false);
    const [isDesktopDashboardExpanded, setIsDesktopDashboardExpanded] = useState<boolean>(true);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="flex h-screen text-white font-sans overflow-hidden relative"
            style={{
                background: 'linear-gradient(135deg, #0a0f1f 0%, #1a1f35 50%, #0f1419 100%)'
            }}
        >
            {isDashboardOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setIsDashboardOpen(false)}
                    aria-hidden="true"
                ></div>
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-40 w-full sm:w-4/5 md:w-3/4 transform transition-transform duration-300 ease-out flex flex-col
                ${isDashboardOpen ? 'translate-x-0' : '-translate-x-full'}

                lg:relative lg:translate-x-0 lg:flex lg:flex-col lg:transition-all lg:duration-300 overflow-hidden
                ${isDesktopDashboardExpanded ? 'lg:w-3/5 lg:p-6' : 'lg:w-0 lg:p-0'}
            `}
                style={{
                    background: isDashboardOpen || isDesktopDashboardExpanded ? 'rgba(17, 25, 40, 0.8)' : 'transparent',
                    backdropFilter: isDashboardOpen || isDesktopDashboardExpanded ? 'blur(40px) saturate(180%)' : 'none',
                    borderRight: isDesktopDashboardExpanded ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                }}
            >
                <div className="p-6 flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent tracking-tight">NEXUS</h1>
                        <p className="text-sm text-gray-400 font-medium mt-1">Your Command Center</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => supabase.auth.signOut()}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-300"
                            aria-label="Sign out"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setIsDashboardOpen(false)}
                            className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-300"
                            aria-label="Close panel"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {dbError ? (
                    <div className="mx-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <h3 className="font-semibold text-red-400">Database Error</h3>
                        <p className="text-sm text-red-300 mt-1 whitespace-pre-wrap">{dbError}</p>
                    </div>
                ) : (
                    <Dashboard
                        transactions={transactions}
                        tasks={tasks}
                        onUpdateTask={handleUpdateTask}
                        onDeleteTask={handleDeleteTask}
                        onEditTask={handleEditTask}
                        onSyncToCalendar={handleSyncToCalendar}
                        onSyncFromCalendar={handleSyncFromCalendar}
                        onSyncAllToCalendar={handleSyncAllToCalendar}
                    />
                )}
            </aside>

            <main className="flex-1 flex flex-col h-screen min-w-0 relative">
                <header className="fixed top-0 left-0 right-0 lg:left-auto z-20 px-4 py-4 flex items-center space-x-4 flex-shrink-0"
                    style={{
                        background: 'rgba(17, 25, 40, 0.8)',
                        backdropFilter: 'blur(40px) saturate(180%)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                >
                    <button
                        onClick={() => setIsDashboardOpen(true)}
                        className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all duration-300"
                        aria-label="Open panel"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setIsDesktopDashboardExpanded(prev => !prev)}
                        className="hidden lg:block p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all duration-300"
                        aria-label={isDesktopDashboardExpanded ? "Collapse panel" : "Expand panel"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h2 className="text-lg font-semibold text-gray-200">Chat</h2>
                </header>

                <div ref={chatContainerRef} className="flex-1 px-4 py-4 space-y-4 overflow-y-auto mt-[72px] mb-[88px]">
                    {messages.map((msg, index) => (
                        <ChatMessage
                            key={index}
                            message={msg}
                            isLoading={isLoading && index === messages.length - 1}
                        />
                    ))}
                </div>

                <div className="fixed bottom-0 left-0 right-0 lg:left-auto z-20 px-4 py-4"
                    style={{
                        background: 'rgba(17, 25, 40, 0.8)',
                        backdropFilter: 'blur(40px) saturate(180%)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                >
                    <div className="max-w-4xl mx-auto">
                        <ChatInput
                            onSendMessage={handleSendMessage}
                            onAudioUpload={handleAudioUpload}
                            isLoading={isLoading}
                            isRecording={isRecording}
                            onToggleRecording={handleToggleRecording}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};
