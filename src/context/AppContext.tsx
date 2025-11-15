import React, { createContext, useContext, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import type { Transaction, Task, Message } from '../../types';
import { useAuth } from '../hooks/useAuth';
import { useDatabase } from '../hooks/useDatabase';
import { useGeminiChat } from '../hooks/useGeminiChat';
import { useAudioRecording } from '../hooks/useAudioRecording';

interface AppContextType {
    session: Session | null;
    userId: string | undefined;
    transactions: Transaction[];
    tasks: Task[];
    dbError: string | null;
    messages: Message[];
    isLoading: boolean;
    isRecording: boolean;
    handleSendMessage: (text: string) => Promise<void>;
    handleAudioUpload: (file: File) => Promise<void>;
    handleToggleRecording: () => void;
    handleUpdateTask: (id: number, isCompleted: boolean) => Promise<void>;
    handleDeleteTask: (id: number) => Promise<void>;
    handleEditTask: (id: number, updates: { description?: string; due_at?: string | null; duration?: number | null }) => Promise<void>;
    handleSyncToCalendar: (taskId: number) => Promise<void>;
    handleSyncFromCalendar: () => Promise<void>;
    handleSyncAllToCalendar: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const { session, userId } = useAuth();

    const {
        transactions,
        tasks,
        dbError,
        refreshDashboardData,
        handleUpdateTask,
        handleDeleteTask,
        handleEditTask,
        handleSyncToCalendar,
        handleSyncFromCalendar,
        handleSyncAllToCalendar,
        checkSupabaseError
    } = useDatabase();

    const { messages, isLoading, handleSendMessage, setMessages } = useGeminiChat(
        userId,
        refreshDashboardData,
        checkSupabaseError
    );

    const { isRecording, handleToggleRecording, handleAudioUpload } = useAudioRecording(
        handleSendMessage,
        userId,
        setMessages
    );

    const wrappedSyncFromCalendar = async () => {
        await handleSyncFromCalendar(userId);
    };

    const wrappedSyncAllToCalendar = async () => {
        try {
            const message = await handleSyncAllToCalendar();
            setMessages(prev => [...prev, { role: 'model', text: message }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', text: 'Erro ao sincronizar com o Google Calendar. Verifique sua conexão.' }]);
        }
    };

    return (
        <AppContext.Provider
            value={{
                session,
                userId,
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
                handleSyncFromCalendar: wrappedSyncFromCalendar,
                handleSyncAllToCalendar: wrappedSyncAllToCalendar
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within AppProvider');
    }
    return context;
}
