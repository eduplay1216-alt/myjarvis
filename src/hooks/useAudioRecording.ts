import { useState, useCallback } from 'react';
import type { Message } from '../../types';
import { supabase } from '../services/supabaseClient';

const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
    });

export function useAudioRecording(handleSendMessage: (text: string) => Promise<void>, userId: string | undefined, setMessages: React.Dispatch<React.SetStateAction<Message[]>>) {
    const [isRecording, setIsRecording] = useState<boolean>(false);

    const handleToggleRecording = useCallback(() => {
        setMessages(prev => [...prev, { role: 'assistant', text: "A funcionalidade de gravação de voz não está disponível com OpenAI." }]);
    }, [setMessages]);

    const handleAudioUpload = useCallback(async (file: File) => {
        if (!userId) {
            console.error("User not authenticated, cannot upload audio.");
            setMessages(prev => [...prev, { role: 'assistant', text: "Autenticação necessária. Por favor, recarregue a página." }]);
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('model', 'whisper-1');

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Transcription error: ${response.status}`);
            }

            const data = await response.json();
            const transcription = data.text?.trim();

            if (transcription) {
                await handleSendMessage(transcription);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', text: "Não foi possível transcrever o áudio, Senhor." }]);
            }

        } catch (error) {
            console.error('Error transcribing audio:', error);
            const errorMessage: Message = { role: 'assistant', text: "Peço desculpas, Senhor. Não consegui processar o arquivo de áudio." };
            setMessages(prev => [...prev, errorMessage]);

            if (userId) {
                supabase.from('messages').insert({ ...errorMessage, user_id: userId }).then(({ error }) => {
                    if (error) console.error('Supabase error message insert error:', error.message);
                });
            }
        }
    }, [userId, handleSendMessage, setMessages]);

    return {
        isRecording,
        handleToggleRecording,
        handleAudioUpload
    };
}
