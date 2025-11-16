import React, { useEffect, useState } from 'react';
import { supabase } from '/src/services/supabaseClient';
import { initGoogleCalendar, handleAuthClick, isSignedIn, handleSignoutClick, setCalendarToken } from '../utils/calendar';

interface GoogleCalendarAuthProps {
    onAuthChange: (isAuthenticated: boolean) => void;
}

// ⚠️ SUBSTITUA PELA SUA URL DE BACKEND/EDGE FUNCTION
// Esta é a URL: https://xshwoyexbpbnnyjjizfj.supabase.co/functions/v1/bright-endpoint
const ENDPOINT_URL = 'https://xshwoyexbpbnnyljizfj.supabase.co/functions/v1/bright-endpoint';

/**
 * Função auxiliar para enviar o código de autorização para o backend para obter os tokens.
 */
const exchangeCodeForTokens = async (code: string, userId: string): Promise<string> => {
    const response = await fetch(ENDPOINT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // Envia o código e o ID do usuário para o backend
        body: JSON.stringify({ code, userId }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error during token exchange' }));
        throw new Error(`Falha ao trocar código por tokens: ${errorData.error || response.statusText}`);
    }

    // O backend deve retornar o Access Token no corpo da resposta
    const data = await response.json();
    if (!data.accessToken) {
        throw new Error("Backend didn't return an accessToken.");
    }
    return data.accessToken;
};

export const GoogleCalendarAuth: React.FC<GoogleCalendarAuthProps> = ({ onAuthChange }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- LÓGICA DE INICIALIZAÇÃO (INALTERADA, EXCETO PELA LIMPEZA) ---
    useEffect(() => {
        const initCalendar = async () => {
            try {
                await initGoogleCalendar();

                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user?.id) {
                    // Busca o Access Token (e Refresh Token, se presente) do Supabase
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
                        const signedIn = isSignedIn();
                        setIsAuthenticated(signedIn);
                        onAuthChange(signedIn);
                    }
                } else {
                    const signedIn = isSignedIn();
                    setIsAuthenticated(signedIn);
                    onAuthChange(signedIn);
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

    // --- LÓGICA DE LOGIN (CORRIGIDA PARA FLUXO DE CÓDIGO) ---
    const handleSignIn = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // 1. Inicia o fluxo de autorização e obtém o CÓDIGO
            const authResponse = await handleAuthClick(); 
            
            // Verifica se o Google retornou um erro (ex: usuário cancelou)
            if (authResponse.error) {
                 throw new Error(`Google Auth Error: ${authResponse.error}`);
            }

            const { data: { session } } = await supabase.auth.getSession();
            
            if (session?.user?.id && authResponse.code) {
                // 2. Envia o CÓDIGO para o backend para troca por tokens (Access/Refresh)
                const accessToken = await exchangeCodeForTokens(authResponse.code, session.user.id);
                
                // 3. Define o Access Token no gapi para uso imediato
                setCalendarToken(accessToken);

                // O Refresh Token foi salvo no Supabase pela Edge Function
            } else {
                // Se o código não veio, algo falhou no Google
                throw new Error("Não foi possível obter o código de autorização do Google.");
            }

            setIsAuthenticated(true);
            onAuthChange(true);
        } catch (err) {
            console.error('Error signing in:', err);
            // Mostrar mensagem mais útil
            setError(`Erro ao fazer login no Google Calendar: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsLoading(false);
        }
    };

    // --- LÓGICA DE LOGOUT (Simplificada e Segura) ---
    const handleSignOut = async () => {
        // 1. Revoga o token no Google e limpa o gapi localmente
        handleSignoutClick(); 

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
            // 2. Deleta a entrada do usuário no Supabase
            // Como agora temos o Refresh Token, podemos criar uma função de backend
            // para revogar o Refresh Token com segurança aqui.
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