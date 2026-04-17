import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Mic2, 
  Calendar, 
  Settings, 
  Upload, 
  Search,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  X,
  ChevronRight,
  Send,
  Loader2,
  FileText,
  AlertCircle
} from 'lucide-react';
import { geminiService, Candidate } from './services/geminiService';
import { CandidateCard } from './components/CandidateCard';
import { useLiveInterview } from './hooks/useLiveInterview';
import { CandidatePortal } from './components/CandidatePortal';
import Markdown from 'react-markdown';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'screening' | 'interview' | 'calendar'>('dashboard');
  const [jd, setJd] = useState('');
  const [resumes, setResumes] = useState<{ name: string; data: string; mimeType: string }[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [interviewReport, setInterviewReport] = useState<any>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [topPercentage, setTopPercentage] = useState<number>(100);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);

  const refreshCandidates = async () => {
    const response = await fetch('/api/candidates');
    if (!response.ok) {
      throw new Error('Failed to fetch candidates');
    }

    const data = await response.json();
    setCandidates(data);
    return data;
  };

  // Simple routing
  const path = window.location.pathname;
  if (path.startsWith('/portal/')) {
    const candidateId = path.split('/')[2];
    return <CandidatePortal candidateId={candidateId} />;
  }

  useEffect(() => {
    refreshCandidates().catch(err => {
      console.error('Failed to load candidates:', err);
    });
  }, []);

  useEffect(() => {
    if (selectedCandidate) {
      const updated = candidates.find(c => c.id === selectedCandidate.id);
      if (updated) setSelectedCandidate(updated);
    }
  }, [candidates]);
  
  const handleInterviewEnd = async (transcript: string) => {
    if (!selectedCandidate) return;
    setIsGeneratingReport(true);
    try {
      const report = await geminiService.generateInterviewReport(
        transcript,
        selectedCandidate.jd || jd,
        selectedCandidate.resumeText
      );

      const response = await fetch(`/api/candidates/${selectedCandidate.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save interview report');
      }

      setInterviewReport(report);
      await refreshCandidates();
    } catch (err) {
      console.error("Failed to generate report:", err);
      alert(err instanceof Error ? err.message : 'Failed to generate interview report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Interview State
  const { isConnected, isSetupComplete, transcript, isRecording, error, timeLeft, startInterview, stopInterview, toggleRecording } = useLiveInterview(
    jd, 
    selectedCandidate?.resumeText || '',
    handleInterviewEnd
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newResumes = await Promise.all(Array.from(files).map(async file => {
      return new Promise<{ name: string; data: string; mimeType: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ name: file.name, data: base64, mimeType: file.type });
        };
        reader.readAsDataURL(file);
      });
    }));

    setResumes(prev => [...prev, ...newResumes]);
  };

  const runScreening = async () => {
    if (!jd || resumes.length === 0) return;
    setIsProcessing(true);
    try {
      const results = await geminiService.screenResumes(jd, resumes);
      setCandidates(results);
      
      // Save candidates to DB
      for (const c of results) {
        await fetch('/api/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...c,
            jd
          })
        });
      }
      
      setActiveTab('screening');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendSchedulingLink = async (candidate: Candidate) => {
    setIsSendingLink(true);
    try {
      const response = await fetch(`/api/candidates/${candidate.id}/send-scheduling-link`, {
        method: 'POST'
      });
      if (response.ok) {
        alert('Scheduling link sent to candidate!');
        await refreshCandidates();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to send link'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to server');
    } finally {
      setIsSendingLink(false);
    }
  };

  const deleteCandidate = async (candidate: Candidate) => {
    const confirmed = window.confirm(`Are you sure you want to delete ${candidate.name}?`);
    if (!confirmed) return;

    setDeletingCandidateId(candidate.id);
    try {
      const response = await fetch(`/api/candidates/${candidate.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete candidate');
      }

      setCandidates(prev => prev.filter(c => c.id !== candidate.id));
      setSelectedCandidate(prev => prev?.id === candidate.id ? null : prev);
      setInterviewReport(prev => (selectedCandidate?.id === candidate.id ? null : prev));
    } catch (err) {
      console.error('Failed to delete candidate:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete candidate');
    } finally {
      setDeletingCandidateId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex text-zinc-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-bold">H</div>
          <span className="font-bold text-xl tracking-tight">HireAI</span>
        </div>

        <nav className="flex-1 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'screening', icon: Users, label: 'Candidates' },
            { id: 'interview', icon: Mic2, label: 'Interview Room' },
            { id: 'calendar', icon: Calendar, label: 'Schedule' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id 
                  ? 'bg-zinc-900 text-white shadow-md' 
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-zinc-100">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-zinc-500 hover:bg-zinc-100 transition-all">
            <Settings size={18} />
            Settings
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-bottom border-zinc-200 flex items-center justify-between px-8">
          <h2 className="text-lg font-semibold capitalize">{activeTab}</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input 
                type="text" 
                placeholder="Search candidates..." 
                className="pl-10 pr-4 py-2 bg-zinc-100 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-zinc-900 transition-all"
              />
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-200 overflow-hidden">
              <img src="https://picsum.photos/seed/recruiter/100/100" alt="User" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-5xl mx-auto space-y-8"
              >
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { label: 'Total Candidates', value: candidates.length, icon: Users, color: 'text-blue-600' },
                    { label: 'Interviews Today', value: '4', icon: Clock, color: 'text-amber-600' },
                    { label: 'Hired This Month', value: '12', icon: CheckCircle2, color: 'text-emerald-600' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-2xl bg-zinc-50 ${stat.color}`}>
                          <stat.icon size={24} />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-zinc-900">{stat.value}</div>
                      <div className="text-sm text-zinc-500 mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Plus className="text-zinc-400" /> New Hiring Campaign
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">Job Description</label>
                      <textarea 
                        value={jd}
                        onChange={(e) => setJd(e.target.value)}
                        placeholder="Paste the job description here..."
                        className="w-full h-48 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 transition-all resize-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">Upload Resumes (PDF)</label>
                      <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-10 flex flex-col items-center justify-center bg-zinc-50 hover:bg-zinc-100 transition-all cursor-pointer relative">
                        <input 
                          type="file" 
                          multiple 
                          accept=".pdf" 
                          onChange={handleFileUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Upload className="text-zinc-400 mb-4" size={32} />
                        <p className="text-sm text-zinc-500">Drag & drop resumes or <span className="text-zinc-900 font-semibold underline">browse files</span></p>
                        <p className="text-xs text-zinc-400 mt-2">Supports multiple PDF files</p>
                      </div>
                      {resumes.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {resumes.map((r, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200 rounded-full text-xs">
                              <FileText size={14} className="text-zinc-400" />
                              {r.name}
                              <button onClick={() => setResumes(prev => prev.filter((_, idx) => idx !== i))} className="text-zinc-400 hover:text-rose-500">
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={runScreening}
                      disabled={isProcessing || !jd || resumes.length === 0}
                      className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" /> : <ArrowRight size={20} />}
                      {isProcessing ? 'Processing Resumes...' : 'Start AI Screening'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'screening' && (
              <motion.div 
                key="screening"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex gap-8"
              >
                <div className="w-1/3 space-y-4 overflow-y-auto pr-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-zinc-500 uppercase tracking-widest text-xs">Ranked Candidates</h3>
                    <div className="flex items-center gap-2">
                      <select 
                        value={topPercentage}
                        onChange={(e) => setTopPercentage(Number(e.target.value))}
                        className="text-[10px] font-bold bg-zinc-100 border-none rounded-md px-2 py-1 focus:ring-1 focus:ring-zinc-900"
                      >
                        <option value={100}>All</option>
                        <option value={5}>Top 5%</option>
                        <option value={10}>Top 10%</option>
                        <option value={25}>Top 25%</option>
                        <option value={50}>Top 50%</option>
                      </select>
                      <span className="text-xs font-medium bg-zinc-100 px-2 py-1 rounded-md">
                        {Math.ceil((candidates.length * topPercentage) / 100)} / {candidates.length}
                      </span>
                    </div>
                  </div>
                  {candidates
                    .sort((a, b) => b.finalScore - a.finalScore)
                    .slice(0, Math.ceil((candidates.length * topPercentage) / 100))
                    .map(candidate => (
                      <CandidateCard 
                        key={candidate.id} 
                        candidate={candidate} 
                        isSelected={selectedCandidate?.id === candidate.id}
                        onSelect={setSelectedCandidate}
                        onDelete={deleteCandidate}
                        isDeleting={deletingCandidateId === candidate.id}
                      />
                    ))}
                </div>

                <div className="flex-1 bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
                  {selectedCandidate ? (
                    <>
                      <div className="p-8 border-b border-zinc-100 flex justify-between items-start">
                        <div>
                          <h2 className="text-3xl font-bold text-zinc-900">{selectedCandidate.name}</h2>
                          <p className="text-zinc-500 mt-1">{selectedCandidate.email} • {selectedCandidate.phone}</p>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => sendSchedulingLink(selectedCandidate)}
                            disabled={isSendingLink}
                            className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            {isSendingLink ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} 
                            {selectedCandidate.status === 'SCREENED' ? 'Send Scheduling Link' : 'Resend Link'}
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedCandidate(selectedCandidate);
                              setActiveTab('interview');
                            }}
                            className="px-6 py-2.5 bg-white border border-zinc-200 text-zinc-900 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all flex items-center gap-2"
                          >
                            <Mic2 size={16} /> Start AI Interview
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-8 space-y-8">
                        {selectedCandidate.report && (
                          <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl space-y-4">
                            <div className="flex justify-between items-center">
                              <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                                <CheckCircle2 size={18} /> Screening Interview Report
                              </h4>
                              <span className="text-xs font-bold bg-emerald-200 text-emerald-700 px-2 py-1 rounded">COMPLETED</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-white/50 p-3 rounded-xl">
                                <div className="text-[10px] uppercase font-bold text-emerald-600">Knowledge</div>
                                <div className="text-xl font-bold">{selectedCandidate.report.knowledgeScore}/10</div>
                              </div>
                              <div className="bg-white/50 p-3 rounded-xl">
                                <div className="text-[10px] uppercase font-bold text-emerald-600">Confidence</div>
                                <div className="text-xl font-bold">{selectedCandidate.report.confidenceScore}/10</div>
                              </div>
                            </div>
                            <p className="text-sm text-emerald-800 leading-relaxed italic">"{selectedCandidate.report.reasoning}"</p>
                            <button 
                              onClick={() => {
                                setInterviewReport(selectedCandidate.report);
                                setActiveTab('interview');
                              }}
                              className="text-sm font-bold text-emerald-700 underline"
                            >
                              View Full Report
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <h4 className="font-bold text-zinc-900">AI Verdict</h4>
                            <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                              <p className="text-sm text-zinc-600 leading-relaxed italic">"{selectedCandidate.summary}"</p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h4 className="font-bold text-zinc-900">Skill Analysis</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">Match Score</span>
                                <span className="font-bold">{selectedCandidate.skillMatchScore}%</span>
                              </div>
                              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${selectedCandidate.skillMatchScore}%` }} />
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">Semantic Fit</span>
                                <span className="font-bold">{selectedCandidate.semanticScore}%</span>
                              </div>
                              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${selectedCandidate.semanticScore}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-bold text-zinc-900">Extracted Skills</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedCandidate.skills.map(skill => (
                              <span key={skill} className="px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full text-xs font-medium">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-bold text-zinc-900">Resume Content</h4>
                          <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 text-sm text-zinc-600 font-mono whitespace-pre-wrap">
                            {selectedCandidate.resumeText}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
                      <Users size={48} className="mb-4 opacity-20" />
                      <p>Select a candidate to view detailed AI analysis</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'interview' && (
              <motion.div 
                key="interview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-4xl mx-auto h-full flex flex-col"
              >
                <div className="bg-zinc-900 rounded-3xl p-8 text-white flex-1 flex flex-col shadow-2xl relative overflow-hidden">
                  {/* Background Glow */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />
                  
                  <div className="flex justify-between items-center mb-10 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-blue-400">
                        <Mic2 size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl">AI Interview Room</h3>
                        <p className="text-sm text-white/40">Powered by Gemini 2.5 Flash</p>
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
                        {isConnected ? 'End Session' : 'Start Screening Call'}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="mx-8 mb-4 p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-400 text-xs flex items-center gap-2 relative z-10">
                      <AlertCircle size={14} /> {error}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto space-y-6 mb-8 pr-4 custom-scrollbar relative z-10">
                    {isGeneratingReport ? (
                      <div className="h-full flex flex-col items-center justify-center text-white text-center">
                        <Loader2 className="animate-spin mb-4" size={48} />
                        <p className="text-xl font-bold">Generating Screening Report...</p>
                        <p className="text-white/40 mt-2">Analyzing the conversation and resume...</p>
                      </div>
                    ) : interviewReport ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white text-zinc-900 rounded-3xl p-8 space-y-8 overflow-y-auto max-h-full"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-2xl font-bold">Screening Report</h3>
                            <p className="text-zinc-500">Candidate: {selectedCandidate?.name}</p>
                          </div>
                          <div className={`px-4 py-2 rounded-xl font-bold text-sm ${
                            interviewReport.recommendation === 'PROCEED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {interviewReport.recommendation}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                            <div className="text-xs font-bold text-zinc-400 uppercase mb-1">Knowledge Score</div>
                            <div className="text-2xl font-bold text-zinc-900">{interviewReport.knowledgeScore}/10</div>
                          </div>
                          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                            <div className="text-xs font-bold text-zinc-400 uppercase mb-1">Confidence Score</div>
                            <div className="text-2xl font-bold text-zinc-900">{interviewReport.confidenceScore}/10</div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-bold flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={18} /> Key Strengths</h4>
                          <ul className="list-disc list-inside text-sm text-zinc-600 space-y-1">
                            {interviewReport.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-bold flex items-center gap-2"><AlertCircle className="text-rose-500" size={18} /> Areas of Concern</h4>
                          <ul className="list-disc list-inside text-sm text-zinc-600 space-y-1">
                            {interviewReport.concerns.map((c: string, i: number) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-bold">Motivation & Timings</h4>
                          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-sm text-zinc-600 leading-relaxed">
                            <p><strong>Motivation:</strong> {interviewReport.motivationSummary}</p>
                            <p className="mt-2"><strong>Timings:</strong> {interviewReport.timingsSummary}</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-bold">AI Reasoning</h4>
                          <p className="text-sm text-zinc-600 leading-relaxed">{interviewReport.reasoning}</p>
                        </div>

                        <button 
                          onClick={() => {
                            setInterviewReport(null);
                            setActiveTab('screening');
                          }}
                          className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all"
                        >
                          Back to Candidates
                        </button>
                      </motion.div>
                    ) : transcript.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-white/20 text-center">
                        <Mic2 size={64} className="mb-4" />
                        <p className="max-w-xs">Click "Start Screening Call" to begin the 5-minute session with {selectedCandidate?.name || 'the candidate'}.</p>
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
                        'Connect to start the interview'
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

            {activeTab === 'calendar' && (
              <motion.div 
                key="calendar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-5xl mx-auto"
              >
                <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-bold">Interview Calendar</h3>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-zinc-100 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-all">Today</button>
                      <button className="px-4 py-2 bg-zinc-100 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-all">Month</button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-px bg-zinc-100 border border-zinc-100 rounded-2xl overflow-hidden">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="bg-zinc-50 p-4 text-center text-xs font-bold text-zinc-400 uppercase tracking-widest">{day}</div>
                    ))}
                    {Array.from({ length: 35 }).map((_, i) => (
                      <div key={i} className="bg-white p-4 h-32 hover:bg-zinc-50 transition-all group relative">
                        <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-900">{i + 1}</span>
                        {i === 12 && (
                          <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-500 rounded text-[10px]">
                            <div className="font-bold text-blue-700">Alex Rivera</div>
                            <div className="text-blue-600">10:30 AM</div>
                          </div>
                        )}
                        {i === 14 && (
                          <div className="mt-2 p-2 bg-emerald-50 border-l-4 border-emerald-500 rounded text-[10px]">
                            <div className="font-bold text-emerald-700">Sarah Chen</div>
                            <div className="text-emerald-600">2:00 PM</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
