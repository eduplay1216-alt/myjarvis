import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveServerMessage, Blob } from '@google/genai';
import type { Message } from '../../types';
import { supabase } from '/src/services/supabaseClient';
import { createBlob, decode, decodeAudioData } from '../../utils/audio';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

interface LiveSession {
    close: () => void;
    sendRealtimeInput: (input: { media: Blob }) => void;
}

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

    const liveSessionRef = useRef<LiveSession | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const currentInputTranscriptionRef = useRef('');

    const stopRecording = useCallback(() => {
        setIsRecording(false);
        if (liveSessionRef.current) {
            liveSessionRef.current.close();
            liveSessionRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().then(() => audioContextRef.current = null);
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close().then(() => outputAudioContextRef.current = null);
        }
    }, []);

    const startRecording = useCallback(async () => {
        setIsRecording(true);

        try {
            const ai = new GoogleGenAI({ apiKey: API_KEY! });

            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = audioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
                        mediaStreamSourceRef.current = source;

                        const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob: Blob = createBlob(inputData);
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(audioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            const finalTranscription = currentInputTranscriptionRef.current.trim();
                            currentInputTranscriptionRef.current = '';
                            stopRecording();
                            if (finalTranscription) {
                                await handleSendMessage(finalTranscription);
                            }
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            nextStartTimeRef.current = Math.max(
                                nextStartTimeRef.current,
                                outputAudioContextRef.current.currentTime,
                            );

                            const audioBuffer = await decodeAudioData(
                                decode(base64Audio),
                                outputAudioContextRef.current,
                                24000,
                                1,
                            );
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setMessages(prev => [...prev, {role: 'model', text: "Houve um erro com a conversa por voz."}]);
                        stopRecording();
                    },
                    onclose: () => {},
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                },
            });

            liveSessionRef.current = await sessionPromise;

        } catch (err) {
            console.error('Failed to start recording:', err);
            setMessages(prev => [...prev, {role: 'model', text: "Não consegui acessar seu microfone. Por favor, verifique as permissões."}]);
            stopRecording();
        }
    }, [stopRecording, handleSendMessage, setMessages]);

    const handleToggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    const handleAudioUpload = useCallback(async (file: File) => {
        if (!userId) {
            console.error("User not authenticated, cannot upload audio.");
            setMessages(prev => [...prev, { role: 'model', text: "Autenticação necessária. Por favor, recarregue a página." }]);
            return;
        }

        try {
            const base64Audio = await fileToBase64(file);
            const ai = new GoogleGenAI({ apiKey: API_KEY! });

            const audioPart = {
                inlineData: {
                    mimeType: file.type,
                    data: base64Audio,
                },
            };
            const textPart = { text: "Transcreva este áudio. Responda APENAS com o texto transcrito." };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: [{ parts: [audioPart, textPart] }],
            });

            const transcription = response.text?.trim();

            if (transcription) {
                await handleSendMessage(transcription);
            } else {
                setMessages(prev => [...prev, { role: 'model', text: "Não foi possível transcrever o áudio, Senhor." }]);
            }

        } catch (error) {
            console.error('Error transcribing audio:', error);
            const errorMessage: Message = { role: 'model', text: "Peço desculpas, Senhor. Não consegui processar o arquivo de áudio." };
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
