import { useState, useCallback, useEffect } from 'react';
import type { Message } from '../../types';
import { supabase } from '../services/supabaseClient';
import { SYSTEM_INSTRUCTION } from '../config/geminiConfig';
import { createApiTools } from '../services/toolImplementations';

export function useOpenAIChat(userId: string | undefined, onNewToolCall: () => Promise<void>, checkSupabaseError: (error: any) => boolean) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const loadHistory = useCallback(async () => {
        try {
            const { data: initialMessages, error } = await supabase
                .from('messages')
                .select('role, text')
                .order('created_at', { ascending: true });

            if (error) {
                if (checkSupabaseError(error)) return;
                throw new Error(`Supabase fetch error: ${error.message}`);
            }
            setMessages(initialMessages as Message[] || []);

            await onNewToolCall();

        } catch (error: any) {
            console.error('Initialization failed:', error);
            let errorMessageText = "Parece que estou com problemas para inicializar. Por favor, verifique o console.";
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                errorMessageText = "Falha na comunicação com o banco de dados. Verifique sua conexão com a internet ou se há algum bloqueador de conteúdo ativo e recarregue a página.";
            }
            setMessages(prev => [...prev, {role: 'assistant', text: errorMessageText}]);
        }
    }, [checkSupabaseError, onNewToolCall]);

    useEffect(() => {
        if (userId) {
            loadHistory();
        }
    }, [userId, loadHistory]);

    const handleSendMessage = useCallback(async (inputText: string) => {
        if (!inputText.trim() || isLoading) return;
        if (!userId) {
            console.error("User not authenticated, cannot send message.");
            setMessages(prev => [...prev, {role: 'assistant', text: "Autenticação necessária. Por favor, recarregue a página."}]);
            return;
        }

        const tools = createApiTools(userId);

        setIsLoading(true);
        const userMessage: Message = { role: 'user', text: inputText };
        setMessages(prev => [...prev, userMessage, { role: 'assistant', text: '' }]);

        supabase.from('messages').insert({ role: userMessage.role, text: userMessage.text, user_id: userId }).then(({ error }) => {
            if (error) console.error('Supabase user message insert error:', error.message);
        });

        try {
            const now = new Date();
            const dynamicSystemInstruction = `${SYSTEM_INSTRUCTION}\n\n**CONTEXTO ATUAL:** A data e hora de agora (em UTC) são: ${now.toISOString()}. Use esta informação como referência para 'hoje' e para agendar tarefas no futuro.`;

            const openaiMessages = [
                { role: 'system', content: dynamicSystemInstruction },
                ...messages.map(msg => ({
                    role: msg.role === 'model' ? 'assistant' : msg.role,
                    content: msg.text
                })),
                { role: 'user', content: inputText }
            ];

            const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
      { role: "user", content: userText }
    ]
  }),
});


            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const finalResponse = data.reply || '';

            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].text = finalResponse;
                return newMessages;
            });

            if (finalResponse && finalResponse.trim()) {
                supabase.from('messages').insert({ role: 'model', text: finalResponse, user_id: userId }).then(({ error }) => {
                    if (error) console.error('Supabase model message insert error:', error.message);
                });
            }

        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: Message = { role: 'assistant', text: "Peço desculpas, Senhor. Encontrei um erro." };
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = errorMessage;
                return newMessages;
            });
            supabase.from('messages').insert({...errorMessage, user_id: userId}).then(({ error }) => {
                if (error) console.error('Supabase error message insert error:', error.message);
            });
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, messages, onNewToolCall, userId]);

    return {
        messages,
        isLoading,
        handleSendMessage,
        setMessages
    };
}
