import React, { useEffect, useState } from 'react';
import { checkCalendarAuth, getCalendarAuthUrl, logoutCalendar, exchangeCodeForToken } from '../utils/calendarBackend';

interface GoogleCalendarAuthProps {
  onAuthChange: (isAuthenticated: boolean) => void;
}

export const GoogleCalendarAuth: React.FC<GoogleCalendarAuthProps> = ({ onAuthChange }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initCalendar = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
          try {
            await exchangeCodeForToken(code);
            window.history.replaceState({}, document.title, window.location.pathname);
            setIsAuthenticated(true);
            onAuthChange(true);
          } catch (error) {
            console.error('Error exchanging code:', error);
            setError('Erro ao conectar com Google Calendar');
          }
        }

        const connected = await checkCalendarAuth();
        setIsAuthenticated(connected);
        onAuthChange(connected);
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

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const authUrl = await getCalendarAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      console.error('Error signing in:', err);
      setError('Erro ao fazer login no Google Calendar');
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutCalendar();
      setIsAuthenticated(false);
      onAuthChange(false);
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Erro ao desconectar do Google Calendar');
    }
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
