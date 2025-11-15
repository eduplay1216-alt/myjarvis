import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

export function useAuth() {
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        const handleAuthSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Error getting session:', error);
                return;
            }

            setSession(session);

            if (session?.provider_token && session?.user?.id) {
                try {
                    const { data: existingToken } = await supabase
                        .from('google_calendar_tokens')
                        .select('*')
                        .eq('user_id', session.user.id)
                        .maybeSingle();

                    if (!existingToken) {
                        await supabase.from('google_calendar_tokens').insert({
                            user_id: session.user.id,
                            access_token: session.provider_token,
                            refresh_token: session.provider_refresh_token || null,
                            expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                        });
                    } else {
                        await supabase
                            .from('google_calendar_tokens')
                            .update({
                                access_token: session.provider_token,
                                refresh_token: session.provider_refresh_token || existingToken.refresh_token,
                                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                            .eq('user_id', session.user.id);
                    }
                } catch (err) {
                    console.error('Error storing calendar tokens:', err);
                }
            }
        };

        handleAuthSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event, session?.user?.id);
            setSession(session);

            if (session?.provider_token && session?.user?.id) {
                try {
                    const { data: existingToken } = await supabase
                        .from('google_calendar_tokens')
                        .select('*')
                        .eq('user_id', session.user.id)
                        .maybeSingle();

                    if (!existingToken) {
                        await supabase.from('google_calendar_tokens').insert({
                            user_id: session.user.id,
                            access_token: session.provider_token,
                            refresh_token: session.provider_refresh_token || null,
                            expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                        });
                    } else {
                        await supabase
                            .from('google_calendar_tokens')
                            .update({
                                access_token: session.provider_token,
                                refresh_token: session.provider_refresh_token || existingToken.refresh_token,
                                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                            .eq('user_id', session.user.id);
                    }
                } catch (err) {
                    console.error('Error storing calendar tokens:', err);
                }
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return {
        session,
        userId: session?.user?.id
    };
}
