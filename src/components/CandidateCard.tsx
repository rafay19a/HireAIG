import React from 'react';
import { motion } from 'motion/react';
import { Loader2, Mail, Phone, Trash2 } from 'lucide-react';
import { Candidate } from '../services/geminiService';

interface CandidateCardProps {
  candidate: Candidate;
  onSelect: (c: Candidate) => void;
  isSelected: boolean;
  onDelete: (c: Candidate) => void;
  isDeleting?: boolean;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, onSelect, isSelected, onDelete, isDeleting = false }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(candidate)}
      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
        isSelected ? 'bg-zinc-900 border-zinc-700 shadow-lg' : 'bg-white border-zinc-200 hover:border-zinc-400'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-lg ${isSelected ? 'text-white' : 'text-zinc-900'}`}>{candidate.name}</h3>
            {candidate.status && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                candidate.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                candidate.status === 'CONFIRMED' ? 'bg-blue-500/20 text-blue-400' :
                candidate.status === 'SCHEDULING_SENT' ? 'bg-amber-500/20 text-amber-400' :
                'bg-zinc-500/20 text-zinc-400'
              }`}>
                {candidate.status.replace('_', ' ')}
              </span>
            )}
          </div>
          <div className="flex gap-3 mt-1 text-xs opacity-60">
            <span className="flex items-center gap-1"><Mail size={12} /> {candidate.email}</span>
            {candidate.phone && <span className="flex items-center gap-1"><Phone size={12} /> {candidate.phone}</span>}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className={`text-2xl font-bold ${getScoreColor(candidate.finalScore)}`}>
            {candidate.finalScore}%
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(candidate);
            }}
            disabled={isDeleting}
            className={`p-2 rounded-xl border transition-all ${
              isSelected
                ? 'border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white'
                : 'border-zinc-200 text-zinc-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600'
            } disabled:opacity-50`}
            aria-label={`Delete ${candidate.name}`}
            title="Delete candidate"
          >
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(candidate.matchedSkills || []).slice(0, 5).map(skill => (
          <span key={skill} className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-medium uppercase tracking-wider">
            {skill}
          </span>
        ))}
        {candidate.missingSkills && candidate.missingSkills.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-medium uppercase tracking-wider">
            +{candidate.missingSkills.length} Missing
          </span>
        )}
      </div>

      <p className={`text-sm line-clamp-2 ${isSelected ? 'text-zinc-400' : 'text-zinc-600'}`}>
        {candidate.summary}
      </p>

      {candidate.report && (
        <div className={`mt-4 rounded-2xl border p-3 space-y-2 ${
          isSelected ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-emerald-100 bg-emerald-50'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
              isSelected ? 'text-emerald-300' : 'text-emerald-700'
            }`}>
              Interview Report
            </span>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
              candidate.report.recommendation === 'PROCEED'
                ? isSelected ? 'bg-emerald-400/20 text-emerald-200' : 'bg-emerald-100 text-emerald-700'
                : isSelected ? 'bg-rose-400/20 text-rose-200' : 'bg-rose-100 text-rose-700'
            }`}>
              {candidate.report.recommendation}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`rounded-xl p-2 ${isSelected ? 'bg-white/5 text-zinc-200' : 'bg-white text-zinc-700'}`}>
              <div className="uppercase opacity-60">Knowledge</div>
              <div className="text-base font-bold">{candidate.report.knowledgeScore}/10</div>
            </div>
            <div className={`rounded-xl p-2 ${isSelected ? 'bg-white/5 text-zinc-200' : 'bg-white text-zinc-700'}`}>
              <div className="uppercase opacity-60">Confidence</div>
              <div className="text-base font-bold">{candidate.report.confidenceScore}/10</div>
            </div>
          </div>

          {candidate.report.strengths?.length > 0 && (
            <p className={`text-xs line-clamp-2 ${isSelected ? 'text-zinc-300' : 'text-zinc-600'}`}>
              <span className="font-semibold">Strengths:</span> {candidate.report.strengths.join(', ')}
            </p>
          )}

          {candidate.report.concerns?.length > 0 && (
            <p className={`text-xs line-clamp-2 ${isSelected ? 'text-zinc-300' : 'text-zinc-600'}`}>
              <span className="font-semibold">Concerns:</span> {candidate.report.concerns.join(', ')}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
};
