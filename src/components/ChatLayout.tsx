import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Dashboard } from '../Dashboard';
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
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            {isDashboardOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-30 lg:hidden"
                    onClick={() => setIsDashboardOpen(false)}
                    aria-hidden="true"
                ></div>
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-40 w-full sm:w-4/5 md:w-3/4 transform transition-transform duration-300 ease-in-out bg-gray-900 p-4 sm:p-6 flex flex-col
                ${isDashboardOpen ? 'translate-x-0' : '-translate-x-full'}

                lg:relative lg:translate-x-0 lg:flex lg:flex-col lg:transition-all lg:duration-300 overflow-hidden
                ${isDesktopDashboardExpanded ? 'lg:w-3/5 lg:p-6 lg:border-r lg:border-gray-700' : 'lg:w-0 lg:p-0'}
            `}>
                <div className="flex justify-between items-center mb-4 sm:mb-6 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-blue-300 mb-1 sm:mb-2">J.A.R.V.I.S.</h1>
                        <p className="text-sm sm:text-base text-gray-400">Seu painel de controle.</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => supabase.auth.signOut()}
                            className="text-gray-400 hover:text-white transition-colors"
                            aria-label="Sair"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setIsDashboardOpen(false)}
                            className="lg:hidden text-gray-400 hover:text-white"
                            aria-label="Fechar painel"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {dbError ? (
                    <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">
                        <h3 className="font-bold">Erro de Banco de Dados</h3>
                        <p className="text-sm whitespace-pre-wrap">{dbError}</p>
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

            <main className="flex-1 flex flex-col h-screen min-w-0">
                <header className="fixed top-0 left-0 right-0 lg:left-auto z-20 px-2 py-3 sm:p-4 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
                    <button
                        onClick={() => setIsDashboardOpen(true)}
                        className="text-gray-300 hover:text-white lg:hidden p-1"
                        aria-label="Abrir painel"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setIsDesktopDashboardExpanded(prev => !prev)}
                        className="hidden lg:block text-gray-300 hover:text-white"
                        aria-label={isDesktopDashboardExpanded ? "Recolher painel" : "Expandir painel"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h2 className="text-base sm:text-lg font-bold text-blue-300">Chat</h2>
                </header>

                <div ref={chatContainerRef} className="flex-1 px-2 py-3 sm:p-4 space-y-3 sm:space-y-4 md:space-y-6 overflow-y-auto mt-[52px] sm:mt-[64px] mb-[72px] sm:mb-[88px]">
                    {messages.map((msg, index) => (
                        <ChatMessage
                            key={index}
                            message={msg}
                            isLoading={isLoading && index === messages.length - 1}
                        />
                    ))}
                </div>

                <div className="fixed bottom-0 left-0 right-0 lg:left-auto z-20 px-2 py-2 sm:p-4 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700">
                    <div className="max-w-4xl mx-auto flex items-center">
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
