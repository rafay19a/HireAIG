import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export function useLiveInterview(jd: string, resumeText: string, onInterviewEnd?: (transcript: string) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const isSetupCompleteRef = useRef(false);
  const isConnectedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  useEffect(() => {
    if (isConnected && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopInterview();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isConnected, timeLeft]);

  const startInterview = async () => {
    setError(null);
    setTranscript([]); // Clear previous transcript
    setTimeLeft(300); // Reset timer
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      console.log("Attempting to connect to Gemini Live API. API Key present:", !!apiKey);
      
      if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please ensure it is set in the environment.");
      }

      // Initialize AudioContext on user gesture
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `
            You are an expert AI HR Recruiter conducting a brief 5-minute screening call.
            JD: ${jd.slice(0, 2000)}
            Candidate Resume: ${resumeText.slice(0, 2000)}
            
            Purpose:
            1. Briefly verify basic details from the resume.
            2. Discuss the candidate's motivation (why they want this job).
            3. Discuss job timings and availability.
            
            Rules:
            1. Keep the conversation strictly under 5 minutes.
            2. Ask ONE question at a time.
            3. Be professional, friendly, and concise.
            4. DO NOT end the conversation immediately. You must ask at least 3-4 questions to cover the purpose.
            5. Once you have covered the resume, motivation, and timings, politely end the call.
            6. IMPORTANT: When you are ready to end the interview, you MUST say exactly: "THANK_YOU_END_SESSION" at the very end of your final sentence.
            
            Start the interview IMMEDIATELY. Do not wait for the user to speak. 
            Introduce yourself as the HireAI Recruiter and ask the first question about the candidate's background or motivation.
          `,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connection Opened Successfully");
            setIsConnected(true);
            isConnectedRef.current = true;
            setIsSetupComplete(false);
            isSetupCompleteRef.current = false;
            // We pass the promise to setupAudio to avoid race conditions
            setupAudio(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            console.log("Live API Message Received:", JSON.stringify(message).slice(0, 500));
            // Handle setup complete
            if (message.setupComplete) {
              console.log("Live API Setup Complete - AI is ready");
              setIsSetupComplete(true);
              isSetupCompleteRef.current = true;
              
              // Resume audio context only after setup is complete
              if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().then(() => {
                  console.log("AudioContext resumed after setupComplete");
                });
              }
            }

            if (message.serverContent?.modelTurn?.parts) {
              const textPart = message.serverContent.modelTurn.parts.find(p => p.text);
              if (textPart) {
                const text = textPart.text!;
                setTranscript(prev => [...prev, { role: 'model', text }]);
                
                // Only end if the session has been active for a bit or the model is very explicit
                if (text.includes("THANK_YOU_END_SESSION")) {
                  console.log("Termination string detected, ending session...");
                  setTimeout(() => stopInterview(), 3000);
                }
              }

              const audioPart = message.serverContent.modelTurn.parts.find(p => p.inlineData);
              if (audioPart) {
                playAudio(audioPart.inlineData!.data);
              }
            }

            if (message.serverContent?.interrupted) {
              nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
            }
          },
          onclose: () => {
            console.log("Live API Connection Closed");
            setIsConnected(false);
            // If it closed unexpectedly without an error, show a message
            setError(prev => prev || "Connection closed by server.");
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError(`Connection Error: ${err.message || 'Unknown error'}`);
            setIsConnected(false);
          },
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Failed to connect to Interviewer:", err);
      setError(err.message || "Failed to connect to AI Interviewer");
      setIsConnected(false);
    }
  };

  const setupAudio = async (sessionPromise?: Promise<any>) => {
    try {
      console.log("Setting up audio...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      if (!audioContextRef.current) return;
      const audioContext = audioContextRef.current;
      
      // Ensure audio context is running
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      nextStartTimeRef.current = audioContext.currentTime;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        // Use Refs to avoid stale closures
        if (!isConnectedRef.current || !isSetupCompleteRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Precision downsampling from 24000 to 16000
        const ratio = 24000 / 16000;
        const newLength = Math.floor(inputData.length / ratio);
        const pcmData = new Int16Array(newLength);
        
        for (let i = 0; i < newLength; i++) {
          const index = Math.floor(i * ratio);
          // Clamp and scale to 16-bit PCM
          const sample = Math.max(-1, Math.min(1, inputData[index]));
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }

        // More robust base64 conversion
        const buffer = pcmData.buffer;
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = window.btoa(binary);

        const sendData = (session: any) => {
          if (!session || !isConnectedRef.current || !isSetupCompleteRef.current) return;
          try {
            session.sendRealtimeInput({
              media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
            });
          } catch (err) {
            console.warn("Failed to send audio chunk:", err);
          }
        };

        if (sessionRef.current) {
          sendData(sessionRef.current);
        } else if (sessionPromise) {
          sessionPromise.then(sendData);
        }
      };

      source.connect(processor);
      // Connect to destination with 0 gain to ensure onaudioprocess fires in all browsers
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);
      
      setIsRecording(true);
    } catch (err: any) {
      console.error("Audio Setup Error:", err);
      setError(`Microphone Error: ${err.message || 'Could not access microphone'}`);
      stopInterview();
    }
  };

  const playAudio = (base64Data: string) => {
    if (!audioContextRef.current) {
      console.warn("AudioContext not initialized, cannot play audio");
      return;
    }
    
    console.log("Playing audio chunk, length:", base64Data.length);
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcmData = new Int16Array(bytes.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 0x7FFF;
    }

    const buffer = audioContextRef.current.createBuffer(1, floatData.length, 24000);
    buffer.getChannelData(0).set(floatData);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    // Schedule playback
    const currentTime = audioContextRef.current.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  };

  const toggleRecording = () => setIsRecording(!isRecording);

  const stopInterview = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    setIsConnected(false);
    isConnectedRef.current = false;
    setIsSetupComplete(false);
    isSetupCompleteRef.current = false;
    setIsRecording(false);
    
    // Trigger report generation if transcript exists
    if (transcript.length > 0 && onInterviewEnd) {
      const fullTranscript = transcript.map(t => `${t.role.toUpperCase()}: ${t.text}`).join("\n");
      onInterviewEnd(fullTranscript);
    }
  };

  useEffect(() => {
    console.log("Connection state changed:", { isConnected, isSetupComplete, isRecording });
  }, [isConnected, isSetupComplete, isRecording]);

  return {
    isConnected,
    isSetupComplete,
    transcript,
    isRecording,
    error,
    timeLeft,
    startInterview,
    stopInterview,
    toggleRecording
  };
}
