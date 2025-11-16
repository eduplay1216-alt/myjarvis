import React, { useEffect, useState } from 'react';
import { supabase } from '/src/services/supabaseClient';
import { initGoogleCalendar, handleAuthClick, isSignedIn, handleSignoutClick, setCalendarToken } from '../utils/calendar';

interface GoogleCalendarAuthProps {
    onAuthChange: (isAuthenticated: boolean) => void;
}

// ⚠️ URL DA SUA EDGE FUNCTION
const ENDPOINT_URL = 'https://xshwoyexbpbnnyljizfj.supabase.co/functions/v1/bright-endpoint';

/**
 * Função auxiliar para enviar o código de autorização para o backend para obter os tokens.
 * AGORA INCLUI O TOKEN DE AUTENTICAÇÃO DO SUPABASE.
 */
const exchangeCodeForTokens = async (code: string, userId: string, supabaseToken: string): Promise<string> => {
    
    const response = await fetch(ENDPOINT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // ✨ CORREÇÃO: Envia o token de sessão do Supabase para a Edge Function
            'Authorization': `Bearer ${supabaseToken}` 
        },
        // Envia o código e o ID do usuário para o backend
        body: JSON.stringify({ code, userId }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error during token exchange' }));
        // Tenta extrair a mensagem de erro detalhada do Google
        const details = errorData.details ? (errorData.details.error_description || errorData.details.error) : errorData.error;
        throw new Error(`Falha ao trocar código por tokens: ${details || response.statusText}`);
    }

    const data = await response.json();
    if (!data.accessToken) {
        throw new Error("O backend não retornou um accessToken.");
    }
    return data.accessToken;
};

export const GoogleCalendarAuth: React.FC<GoogleCalendarAuthProps> = ({ onAuthChange }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- LÓGICA DE INICIALIZAÇÃO (Verifica se já existe token) ---
    useEffect(() => {
        const initCalendar = async () => {
            try {
                await initGoogleCalendar();
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user?.id) {
                    const { data: tokenData } = await supabase
                        .from('google_calendar_tokens')
                        .select('*')
                        .eq('user_id', session.user.id)
                        .maybeSingle();

                    if (tokenData?.access_token) {
                        try {
                            // Define o token localmente para que o gapi possa usá-lo
                            setCalendarToken(tokenData.access_token);
                            setIsAuthenticated(true);
                            onAuthChange(true);
                        } catch (tokenError) {
                            console.error('Error setting calendar token:', tokenError);
                            setIsAuthenticated(false);
                            onAuthChange(false);
                        }
                    } else {
                        // Limpa se não houver token no DB
                        setIsAuthenticated(false);
                        onAuthChange(false);
                    }
                } else {
                    setIsAuthenticated(false);
                    onAuthChange(false);
                }
            } catch (err) {
                console.error('Error initializing Google Calendar:', err);
                setError('Google Calendar não disponível no momento');
                setIsAuthenticated(false);
                onAuthChange(false);
            } finally {
                setIsLoading(false);
            }
        };

        initCalendar();
    }, [onAuthChange]);

    // --- LÓGICA DE LOGIN (CORRIGIDA PARA ENVIAR O TOKEN) ---
    const handleSignIn = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // 1. Inicia o fluxo de autorização do Google e obtém o CÓDIGO
            const authResponse = await handleAuthClick(); 
            
            if (authResponse.error) {
                 throw new Error(`Erro do Google: ${authResponse.error}`);
            }

            // 2. Obtém a sessão ATUAL do Supabase (para pegar o token de acesso)
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session?.user?.id && authResponse.code && session.access_token) {
                // 3. Envia o CÓDIGO (do Google) e o TOKEN (do Supabase) para o backend
                const accessToken = await exchangeCodeForTokens(
                    authResponse.code, 
                    session.user.id, 
                    session.access_token // ✨ CORREÇÃO: Passa o token do Supabase
                );
                
                // 4. Define o Access Token do Google no gapi para uso imediato
                setCalendarToken(accessToken);
            } else {
                // Se o código não veio ou a sessão do Supabase falhou
                throw new Error("Não foi possível obter a sessão do Supabase ou o código de autorização do Google.");
            }

            setIsAuthenticated(true);
            onAuthChange(true);
        } catch (err) {
            console.error('Error signing in:', err);
            setError(`Erro ao fazer login: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsLoading(false);
        }
    };

    // --- LÓGICA DE LOGOUT (Simplificada) ---
    const handleSignOut = async () => {
        handleSignoutClick(); // Limpa o GAPI
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.id) {
            // Deleta os tokens do banco
            await supabase
                .from('google_calendar_tokens')
                .delete()
                .eq('user_id', session.user.id);
        }

        setIsAuthenticated(false);
        onAuthChange(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center space-x-2 text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Carregando Google Calendar...</span>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 p-2 rounded text-sm">
                    {error}
                </div>
            )}

            {isAuthenticated ? (
                <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 text-green-400 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Conectado ao Google Calendar</span>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
                    >
                        Desconectar
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleSignIn}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                            fillRule="evenodd"
                            d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                            clipRule="evenodd"
                        />
                    </svg>

                    <span>Conectar ao Google Calendar</span>
                </button>
            )}
        </div>
    );
};