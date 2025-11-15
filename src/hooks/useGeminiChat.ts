import { useState, useCallback, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { Message } from '../../types';
import { supabase } from '../services/supabaseClient';
import { SYSTEM_INSTRUCTION, allTools } from '../config/geminiConfig';
import { createApiTools } from '../services/toolImplementations';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export function useGeminiChat(userId: string | undefined, onNewToolCall: () => Promise<void>, checkSupabaseError: (error: any) => boolean) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const loadHistory = useCallback(async () => {
        try {
            if (!API_KEY) {
                console.error("API key not found.");
                setMessages(prev => [...prev, {role: 'model', text: "Erro de configuração: a chave da API está ausente."}]);
                return;
            }

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
            setMessages(prev => [...prev, {role: 'model', text: errorMessageText}]);
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
            setMessages(prev => [...prev, {role: 'model', text: "Autenticação necessária. Por favor, recarregue a página."}]);
            return;
        }

        const tools = createApiTools(userId);

        setIsLoading(true);
        const userMessage: Message = { role: 'user', text: inputText };
        setMessages(prev => [...prev, userMessage, { role: 'model', text: '' }]);

        supabase.from('messages').insert({ role: userMessage.role, text: userMessage.text, user_id: userId }).then(({ error }) => {
            if (error) console.error('Supabase user message insert error:', error.message);
        });

        try {
            const ai = new GoogleGenAI({ apiKey: API_KEY! });
            const model = 'gemini-2.5-pro';

            const apiHistory: { role: string, parts: any[] }[] = [...messages, userMessage].map(msg => ({
                role: msg.role, parts: [{ text: msg.text }],
            }));

            const now = new Date();
            const dynamicSystemInstruction = `${SYSTEM_INSTRUCTION}\n\n**CONTEXTO ATUAL:** A data e hora de agora (em UTC) são: ${now.toISOString()}. Use esta informação como referência para 'hoje' e para agendar tarefas no futuro.`;

            const config = {
                systemInstruction: dynamicSystemInstruction,
                tools: [{ functionDeclarations: allTools }],
            };

            let finalResponse: string | null = null;

            while (finalResponse === null) {
                const response = await ai.models.generateContent({ model, contents: apiHistory, config });

                if (response.functionCalls && response.functionCalls.length > 0) {
                    const toolExecutionPromises = response.functionCalls.map(async (fc) => {
                        const functionName = fc.name as keyof typeof tools;
                        const toolFn = tools[functionName];
                        let result;

                        if (typeof toolFn === 'function') {
                            result = await toolFn(...Object.values(fc.args));
                        } else {
                            result = { success: false, error: `Tool ${functionName} not found.` };
                        }

                        return {
                            functionResponse: {
                                name: functionName,
                                response: result,
                            },
                        };
                    });

                    const toolResponses = await Promise.all(toolExecutionPromises);
                    await onNewToolCall();

                    const modelResponseWithFunctionCalls = response.candidates?.[0]?.content;
                    if (!modelResponseWithFunctionCalls) {
                        throw new Error("Model response with function calls not found.");
                    }

                    apiHistory.push({ role: modelResponseWithFunctionCalls.role ?? 'model', parts: modelResponseWithFunctionCalls.parts });
                    apiHistory.push({ role: 'tool', parts: toolResponses });

                } else {
                    finalResponse = response.text ?? '';
                }
            }

            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].text = finalResponse!;
                return newMessages;
            });

            if (finalResponse && finalResponse.trim()) {
                supabase.from('messages').insert({ role: 'model', text: finalResponse, user_id: userId }).then(({ error }) => {
                    if (error) console.error('Supabase model message insert error:', error.message);
                });
            }

        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: Message = { role: 'model', text: "Peço desculpas, Senhor. Encontrei um erro." };
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
