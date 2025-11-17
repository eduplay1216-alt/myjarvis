import React, { useState } from 'react';
import { supabase } from '/src/services/supabaseClient';

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
            }
        } catch (error: any) {
            setError(error.error_description || error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                    scopes: 'https://www.googleapis.com/auth/calendar',
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });
            if (error) throw error;
        } catch (error: any) {
            setError(error.error_description || error.message);
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen overflow-hidden relative">
            <div
                className="absolute inset-0 overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, #0a0f1f 0%, #1a1f35 50%, #0f1419 100%)'
                }}
            >
                <div className="absolute top-20 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" style={{ animation: 'pulse 4s ease-in-out infinite' }}></div>
            </div>

            <div className="relative w-full max-w-md mx-4">
                <div
                    className="glass-effect rounded-3xl p-8 space-y-8 shadow-2xl"
                    style={{
                        animation: 'float 6s ease-in-out infinite'
                    }}
                >
                    <div className="text-center space-y-3">
                        <div className="inline-block">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/50">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent tracking-tight">
                            NEXUS
                        </h1>
                        <p className="text-gray-400 text-sm font-medium">
                            {isSignUp ? 'Create your account' : 'Welcome back'}
                        </p>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full px-6 py-4 font-semibold text-gray-900 bg-white rounded-2xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 flex items-center justify-center space-x-3 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span className="text-sm">{loading ? 'Processing...' : 'Continue with Google'}</span>
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-3 text-gray-500 text-xs font-medium" style={{ background: 'rgba(17, 25, 40, 0.75)' }}>or continue with email</span>
                        </div>
                    </div>

                    <form className="space-y-5" onSubmit={handleAuthAction}>
                        <div>
                            <label htmlFor="email" className="text-xs font-semibold text-gray-400 block mb-2 uppercase tracking-wide">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                className="w-full px-4 py-3.5 text-white bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-300 placeholder-gray-500"
                                style={{ backdropFilter: 'blur(10px)' }}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="text-xs font-semibold text-gray-400 block mb-2 uppercase tracking-wide">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full px-4 py-3.5 text-white bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-300 placeholder-gray-500"
                                style={{ backdropFilter: 'blur(10px)' }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-6 py-4 font-semibold text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/50"
                            style={{
                                background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)'
                            }}
                        >
                            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
                        </button>
                    </form>

                    {error && (
                        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <p className="text-sm text-red-400 text-center">{error}</p>
                        </div>
                    )}
                    {message && (
                        <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20">
                            <p className="text-sm text-green-400 text-center">{message}</p>
                        </div>
                    )}

                    <p className="text-sm text-center text-gray-400">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError(null);
                                setMessage(null);
                            }}
                            className="font-semibold text-blue-400 hover:text-blue-300 ml-1.5 transition-colors"
                        >
                            {isSignUp ? 'Sign in' : 'Sign up'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};
