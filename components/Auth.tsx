import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// These should be in a central config, but for this component we can redefine them
const SUPABASE_URL = "https://xshwoyexbpbnnyljizfj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzaHdveWV4YnBibm55bGppemZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNTc4NjEsImV4cCI6MjA3NzczMzg2MX0.nJA2_HVaYpjbUZUY3l0ki695TVZxde_AWs88RwsEcmI";
const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

export const Auth: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);


    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setMessage('Verifique seu e-mail para o link de confirmação.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                // No message needed, the app will redirect on session update
            }
        } catch (error: any) {
            setError(error.error_description || error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
            <div className="w-full max-w-sm p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
                <div>
                    <h1 className="text-3xl font-bold text-center text-blue-300">J.A.R.V.I.S.</h1>
                    <p className="mt-2 text-center text-gray-400">
                        {isSignUp ? 'Iniciando novo protocolo de usuário.' : 'Autenticação de usuário necessária.'}
                    </p>
                </div>
                <form className="space-y-6" onSubmit={handleAuthAction}>
                    <div>
                        <label htmlFor="email" className="text-sm font-bold text-gray-400 block">E-mail</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-2 mt-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="text-sm font-bold text-gray-400 block">Senha</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-2 mt-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {loading ? 'Processando...' : (isSignUp ? 'Registrar' : 'Entrar')}
                        </button>
                    </div>
                </form>
                {error && <p className="text-sm text-center text-red-400">{error}</p>}
                {message && <p className="text-sm text-center text-green-400">{message}</p>}
                <p className="text-sm text-center text-gray-400">
                    {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'}
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp)
                            setError(null)
                            setMessage(null)
                        }}
                        className="font-medium text-blue-400 hover:underline ml-1"
                    >
                        {isSignUp ? 'Entrar' : 'Registrar'}
                    </button>
                </p>
            </div>
        </div>
    );
};
