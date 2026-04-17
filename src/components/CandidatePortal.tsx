import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  Mic2, 
  CheckCircle2, 
  ArrowRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useLiveInterview } from '../hooks/useLiveInterview';
import Markdown from 'react-markdown';

interface CandidatePortalProps {
  candidateId: string;
  initialMode?: 'schedule' | 'interview';
}

export const CandidatePortal: React.FC<CandidatePortalProps> = ({ candidateId, initialMode = 'schedule' }) => {
  const [candidate, setCandidate] = useState<any>(null);
  const [mode, setMode] = useState<'schedule' | 'interview' | 'completed'>(initialMode);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/candidates/${candidateId}`)
      .then(res => res.json())
      .then(data => {
        setCandidate(data);
        if (data.status === 'COMPLETED') setMode('completed');
        else if (data.status === 'CONFIRMED' && window.location.search.includes('mode=interview')) setMode('interview');
      });
  }, [candidateId]);

  const handleInterviewEnd = async (transcript: string) => {
    setIsGeneratingReport(true);
    setSubmitError(null);
    try {
      const { geminiService } = await import('../services/geminiService');
      const report = await geminiService.generateInterviewReport(
        transcript,
        candidate.jd,
        candidate.resumeText
      );
      
      const response = await fetch(`/api/candidates/${candidateId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save interview report');
      }
      
      setCandidate((prev: any) => prev ? { ...prev, report, status: 'COMPLETED' } : prev);
      setMode('completed');
    } catch (err) {
      console.error("Failed to finish interview:", err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to finish interview');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const { isConnected, isSetupComplete, transcript, isRecording, error, timeLeft, startInterview, stopInterview } = useLiveInterview(
    candidate?.jd || '',
    candidate?.resumeText || '',
    handleInterviewEnd
  );

  const confirmTime = async () => {
    if (!selectedTime) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/candidates/${candidateId}/confirm-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: selectedTime })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to confirm interview time');
      }

      alert("Interview confirmed! Check your email for the link.");
      window.location.reload();
    } catch (err) {
      console.error(err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to confirm interview time');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!candidate) return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="flex items-center gap-4 mb-12">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black font-bold text-xl">H</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">HireAI Candidate Portal</h1>
            <p className="text-zinc-500 text-sm">Welcome, {candidate.name}</p>
          </div>
        </header>

        {mode === 'schedule' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900 rounded-3xl p-8 border border-white/5 shadow-2xl">
            <h2 className="text-3xl font-bold mb-2">Schedule Your Interview</h2>
            <p className="text-zinc-400 mb-8">Choose a time for your 15-minute AI screening call.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-zinc-400">Select Date & Time</label>
                <input 
                  type="datetime-local" 
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full bg-zinc-800 border-none rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="bg-blue-500/5 rounded-2xl p-6 border border-blue-500/10">
                <h4 className="font-bold flex items-center gap-2 text-blue-400 mb-2">
                  <Clock size={18} /> What to expect
                </h4>
                <ul className="text-sm text-zinc-400 space-y-2">
                  <li>• 15-minute automated screening</li>
                  <li>• Resume verification & motivation</li>
                  <li>• Real-time voice interaction</li>
                  <li>• Instant feedback for HR</li>
                </ul>
              </div>
            </div>

            <button 
              onClick={confirmTime}
              disabled={!selectedTime || isSubmitting}
              className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowRight size={20} />}
              Confirm Interview Time
            </button>
          </motion.div>
        )}

        {mode === 'interview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[600px] flex flex-col">
            <div className="bg-zinc-900 rounded-3xl p-8 flex-1 flex flex-col shadow-2xl relative overflow-hidden border border-white/5">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />
              
              <div className="flex justify-between items-center mb-10 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-blue-400">
                    <Mic2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">AI Interview Room</h3>
                    <p className="text-sm text-white/40">Screening Call for {candidate.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isConnected && (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/20 text-rose-400 rounded-full text-xs font-bold">
                        <Clock size={12} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" /> LIVE
                      </div>
                    </div>
                  )}
                  <button 
                    onClick={isConnected ? stopInterview : startInterview}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                      isConnected ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    {isConnected ? 'End Session' : 'Start Interview'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mx-8 mb-4 p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-400 text-xs flex items-center gap-2 relative z-10">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              {submitError && (
                <div className="mx-8 mb-4 p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-center gap-2 relative z-10">
                  <AlertCircle size={14} /> {submitError}
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-6 mb-8 pr-4 custom-scrollbar relative z-10">
                {isGeneratingReport ? (
                  <div className="h-full flex flex-col items-center justify-center text-white text-center">
                    <Loader2 className="animate-spin mb-4" size={48} />
                    <p className="text-xl font-bold">Processing Interview...</p>
                    <p className="text-white/40 mt-2">Finalizing your screening results.</p>
                  </div>
                ) : transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 text-center">
                    <Mic2 size={64} className="mb-4" />
                    <p className="max-w-xs">Click "Start Interview" to begin your screening call.</p>
                  </div>
                ) : (
                  transcript.map((msg, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: msg.role === 'model' ? -20 : 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'model' 
                          ? 'bg-white/10 text-white rounded-tl-none' 
                          : 'bg-blue-500 text-white rounded-tr-none'
                      }`}>
                        <Markdown>{msg.text.replace("THANK_YOU_END_SESSION", "")}</Markdown>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-4 relative z-10">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isRecording ? 'bg-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'bg-white/10'
                }`}>
                  <Mic2 size={24} className={isRecording ? 'text-blue-400 animate-pulse' : 'text-white/20'} />
                </div>
                <div className="flex-1 h-12 bg-white/5 rounded-2xl flex items-center px-6 text-white/40 text-sm">
                  {!isConnected ? (
                    'Ready to start'
                  ) : !isSetupComplete ? (
                    <span className="flex items-center gap-2 text-blue-400">
                      <Loader2 className="animate-spin" size={14} />
                      Initializing AI Recruiter...
                    </span>
                  ) : isRecording ? (
                    <span className="flex items-center gap-2 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      AI is listening...
                    </span>
                  ) : (
                    'Audio active'
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'completed' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-4xl font-bold mb-4">Interview Completed</h2>
            <p className="text-zinc-400 max-w-md mx-auto">Thank you for completing the screening call. Our hiring team will review the results and get back to you soon.</p>
            {submitError && (
              <p className="text-amber-300 text-sm mt-4">{submitError}</p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
