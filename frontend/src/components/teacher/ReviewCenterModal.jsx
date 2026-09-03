import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, X, BrainCircuit, TrendingUp } from 'lucide-react'
import { aiService } from '../../services/aiService'

export default function ReviewCenterModal({ submission, assessment, onClose, onSave }) {
    const [manualScore, setManualScore] = useState(submission.manualScore || 0);
    const [feedback, setFeedback] = useState(submission.feedback || '');
    const [aiSuggest, setAiSuggest] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const subjectiveQuestions = (assessment?.questions || []).filter(q => !['mcq', 'msq', 'true_false'].includes(q.type));
    const objectiveQuestions = (assessment?.questions || []).filter(q => ['mcq', 'msq', 'true_false'].includes(q.type));
    
    let calculatedMcqScore = 0;
    let calculatedMcqTotal = 0;
    objectiveQuestions.forEach(q => {
        calculatedMcqTotal += q.maxMarks || 1;
        const studentAns = submission.answers?.[q.id];
        if (q.type === 'mcq' || q.type === 'true_false') {
            if (studentAns === q.correctAnswer) calculatedMcqScore += (q.maxMarks || 1);
        } else if (q.type === 'msq') {
            if (Array.isArray(studentAns) && Array.isArray(q.correctAnswers)) {
                const isCorrect = studentAns.length === q.correctAnswers.length && studentAns.every(v => q.correctAnswers.includes(v));
                if (isCorrect) calculatedMcqScore += (q.maxMarks || 1);
            }
        }
    });

    const displayMcqScore = submission.mcqScore || calculatedMcqScore;
    const displayMcqTotal = submission.mcqTotal || calculatedMcqTotal;
    
    const handleGetAiHelp = async (question, answer, marks) => {
        setIsAnalyzing(true);
        const suggestion = await aiService.analyzeSubjectiveAnswer(question, answer, marks);
        setAiSuggest(suggestion);
        setManualScore(suggestion.suggestedScore);
        setFeedback(suggestion.feedback);
        setIsAnalyzing(false);
    };

    const handleGradeAllWithAI = async () => {
        setIsAnalyzing(true);
        let totalScore = 0;
        let combinedFeedback = "";

        for (let i = 0; i < subjectiveQuestions.length; i++) {
            const q = subjectiveQuestions[i];
            const answer = submission.answers?.[q.id];
            if (!answer) {
                combinedFeedback += `Q${i + 1}: No response provided.\n\n`;
                continue;
            }
            const suggestion = await aiService.analyzeSubjectiveAnswer(q.text, answer, q.maxMarks);
            totalScore += suggestion.suggestedScore || 0;
            combinedFeedback += `Q${i + 1}: ${suggestion.feedback}\n\n`;
        }
        
        setManualScore(totalScore);
        setFeedback(combinedFeedback.trim());
        setAiSuggest({ suggestedScore: totalScore, feedback: combinedFeedback.trim() });
        setIsAnalyzing(false);
    };

    return (
        <motion.div className="lumina-modal-overlay" data-lenis-prevent initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="lumina-profile-modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} style={{ maxWidth: 900, width: '95%' }}>
                <div className="lumina-modal-header">
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--lumina-teal)', letterSpacing: 2, marginBottom: 4 }}>SUBMISSION REVIEW</div>
                        <h2 style={{ marginBottom: 16 }}>{assessment?.title || 'Assessment'}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--lumina-text-main)', cursor: 'pointer', opacity: 0.6 }}><X size={24} /></button>
                </div>

                <div className="lumina-modal-content" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 32, padding: 32 }}>
                    {/* LEFT: Responses */}
                    <div style={{ overflowY: 'auto', paddingRight: 8 }}>
                        {/* MCQ Section */}
                        <div style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.2)', padding: '16px 20px', borderRadius: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <CheckCircle2 size={20} color="var(--lumina-teal)" />
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--lumina-teal)', letterSpacing: 1, marginBottom: 2 }}>AUTO-GRADED · MCQ SECTION</div>
                                <div style={{ fontSize: 15, fontWeight: 700 }}>Score: <span style={{ color: 'var(--lumina-teal)' }}>{displayMcqScore}</span> / {displayMcqTotal}</div>
                            </div>
                        </div>

                        {/* Subjective Section */}
                        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: 'var(--lumina-text-muted)', marginBottom: 16 }}>
                            SUBJECTIVE RESPONSES {subjectiveQuestions.length > 0 ? `(${subjectiveQuestions.length})` : ''}
                        </div>

                        {subjectiveQuestions.length === 0 ? (
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--lumina-border)', borderRadius: 16, padding: '32px 20px', textAlign: 'center', color: 'var(--lumina-text-dim)', fontSize: 13 }}>
                                No subjective questions in this assessment.
                            </div>
                        ) : (
                            subjectiveQuestions.map((q, idx) => (
                                <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 16, marginBottom: 16, border: '1px solid var(--lumina-border)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--lumina-text-muted)', marginBottom: 6 }}>Q{idx + 1} · {q.maxMarks} marks</div>
                                    <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 14, lineHeight: 1.5 }}>{q.text}</p>
                                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', fontSize: 13, minHeight: 60, color: 'var(--lumina-text-dim)', lineHeight: 1.6 }}>
                                        {submission.answers?.[q.id] || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>No response provided.</span>}
                                    </div>
                                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => handleGetAiHelp(q.text, submission.answers?.[q.id], q.maxMarks)}
                                            disabled={isAnalyzing}
                                            style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.3)', color: 'var(--lumina-teal)', padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                        >
                                            <BrainCircuit size={12} /> {isAnalyzing ? 'Grading...' : 'Grade with AI ✨'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* RIGHT: Grading Panel */}
                    <aside>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--lumina-border)', borderRadius: 20, padding: 24, position: 'sticky', top: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: 'var(--lumina-text-muted)' }}>GRADING PANEL</div>
                                {subjectiveQuestions.length > 0 && (
                                    <button
                                        onClick={handleGradeAllWithAI}
                                        disabled={isAnalyzing}
                                        style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--lumina-purple)', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: isAnalyzing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                        <BrainCircuit size={12} /> {isAnalyzing ? 'Grading...' : 'Grade All ✨'}
                                    </button>
                                )}
                            </div>

                            <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--lumina-text-muted)', display: 'block', marginBottom: 8 }}>
                                MANUAL SCORE (MAX {submission.manualTotal ?? 0})
                            </label>
                            <input
                                type="number"
                                value={manualScore}
                                min={0}
                                max={submission.manualTotal ?? 999}
                                onChange={e => setManualScore(parseFloat(e.target.value) || 0)}
                                style={{ width: '100%', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--lumina-border)', color: '#0f172a', padding: '12px 16px', borderRadius: 12, fontSize: 22, fontWeight: 800, outline: 'none', boxSizing: 'border-box' }}
                            />

                            <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--lumina-text-muted)', display: 'block', marginBottom: 8, marginTop: 20 }}>
                                FINAL FEEDBACK
                            </label>
                            <textarea
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                placeholder="Write comments for the student..."
                                style={{ width: '100%', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--lumina-border)', color: '#0f172a', padding: 12, borderRadius: 12, fontSize: 13, minHeight: 110, resize: 'none', outline: 'none', lineHeight: 1.5, boxSizing: 'border-box', fontFamily: 'inherit' }}
                            />

                            {aiSuggest && (
                                <div style={{ marginTop: 16, background: 'rgba(139,92,246,0.08)', padding: 12, borderRadius: 12, border: '1px solid rgba(139,92,246,0.2)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--lumina-purple)', marginBottom: 4 }}>
                                        <TrendingUp size={12} />
                                        <span style={{ fontSize: 9, fontWeight: 800 }}>AI SUGGESTION</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: 11, opacity: 0.8 }}>Suggested Score: {aiSuggest.suggestedScore}</p>
                                </div>
                            )}

                            <button
                                onClick={() => onSave(submission.id, manualScore, feedback)}
                                className="lumina-btn-elite"
                                style={{ width: '100%', marginTop: 24 }}
                            >
                                SAVE GRADE
                            </button>
                        </div>
                    </aside>
                </div>
            </motion.div>
        </motion.div>
    );
}
