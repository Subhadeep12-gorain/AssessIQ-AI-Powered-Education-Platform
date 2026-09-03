import React, { useState } from 'react';
import { aiService } from '../../services/aiService';
import './CreateAssessmentModal.css'; // Reusing the teacher modal CSS for consistency

export default function MockExamModal({ onClose, onGenerate }) {
    const [step, setStep] = useState('config'); // 'config' | 'generating'
    const [formData, setFormData] = useState({
        topic: '',
        duration: '30',
        totalMarks: '20',
        type: 'Mix',
        difficulty: 'Medium'
    });
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        setError(null);
        
        if (!formData.topic.trim()) {
            setError('Please enter a subject or topic.');
            return;
        }

        setStep('generating');
        
        try {
            // Generate questions via AI
            const generatedQs = await aiService.generateQuestions(
                formData.topic,
                formData.type,
                formData.difficulty,
                parseFloat(formData.totalMarks) || 20,
                null // No raw text context for now
            );

            if (!generatedQs || generatedQs.length === 0) {
                throw new Error("AI failed to generate any questions.");
            }

            // Construct the mock assessment object
            const mockAssessment = {
                id: `mock_${Date.now()}`,
                title: `Practice: ${formData.topic}`,
                className: 'AI Practice Test',
                duration: parseFloat(formData.duration) || 30,
                totalMarks: parseFloat(formData.totalMarks) || 20,
                questions: generatedQs,
                isMockAttempt: true,
                isSelfGeneratedMock: true,
                createdAt: new Date().toISOString()
            };

            // Pass it back to Dashboard to save and start
            onGenerate(mockAssessment);

        } catch (err) {
            console.error("Mock generation error:", err);
            setError(err.message || "Failed to generate mock exam. Please try again.");
            setStep('config');
        }
    };

    return (
        <div className="modal-overlay" data-lenis-prevent onClick={onClose}>
            <div className="modal-content modal-large" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{step === 'config' ? 'Create AI Practice Test' : 'AI is building your test...'}</h2>
                    <button className="cam-close-btn" onClick={onClose} type="button" aria-label="Close" disabled={step === 'generating'}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {step === 'config' && (
                    <form onSubmit={handleGenerate}>
                        {error && (
                            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                                {error}
                            </div>
                        )}
                        
                        <div className="form-row">
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-topic">Subject or Topic *</label>
                                <input
                                    id="cam-topic"
                                    className="cam-input"
                                    type="text"
                                    name="topic"
                                    placeholder="e.g., Photosynthesis, Algebra, World War II"
                                    value={formData.topic}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row three-col" style={{ marginTop: '16px', gridTemplateColumns: '1fr 1fr' }}>
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-duration">Duration (mins) *</label>
                                <input id="cam-duration" className="cam-input" type="number" name="duration" value={formData.duration} onChange={handleChange} min="5" max="180" required />
                            </div>
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-totalMarks">Total Marks *</label>
                                <input id="cam-totalMarks" className="cam-input" type="number" name="totalMarks" value={formData.totalMarks} onChange={handleChange} min="5" max="100" required />
                            </div>
                        </div>

                        <div className="form-row three-col" style={{ marginTop: '16px', gridTemplateColumns: '1fr 1fr' }}>
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-type">Question Type</label>
                                <select id="cam-type" className="cam-select" name="type" value={formData.type} onChange={handleChange}>
                                    <option value="MCQ">MCQ</option>
                                    <option value="MSQ (Multiple Select)">MSQ (Multiple Select)</option>
                                    <option value="Fill in the Blank">Fill in the Blank</option>
                                    <option value="Short Answer">Short Answer (SAQ)</option>
                                    <option value="Long Answer">Long Answer / Essay</option>
                                    <option value="Case Study">Case Study / Scenario</option>
                                    <option value="Mix">Mix (All Types)</option>
                                </select>
                            </div>
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-difficulty">Difficulty</label>
                                <select id="cam-difficulty" className="cam-select" name="difficulty" value={formData.difficulty} onChange={handleChange}>
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="btn-generate" style={{ marginTop: '24px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Generate Practice Test
                        </button>
                    </form>
                )}

                {step === 'generating' && (
                    <div style={{ padding: '64px 0', textAlign: 'center' }}>
                        <div className="cam-spinner"></div>
                        <h3 style={{ color: 'var(--auth-text, #0f172a)', marginTop: '24px' }}>AI is building your test...</h3>
                        <p style={{ color: 'var(--auth-text-muted, #71717a)' }}>Generating custom questions based on your parameters.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
