import React from 'react';
import { motion } from 'motion/react';
import { FileText, CheckCircle, XCircle, AlertCircle, Star, User, Mail, Phone, ExternalLink } from 'lucide-react';
import { Candidate } from '../services/geminiService';

interface CandidateCardProps {
  candidate: Candidate;
  onSelect: (c: Candidate) => void;
  isSelected: boolean;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, onSelect, isSelected }) => {
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
        <div className={`text-2xl font-bold ${getScoreColor(candidate.finalScore)}`}>
          {candidate.finalScore}%
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
    </motion.div>
  );
};
