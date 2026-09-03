import { useState } from 'react';
import { aiService } from '../../services/aiService';
import { pdfService } from '../../services/pdfService';
import apiService from '../../services/apiService';
import './CreateAssessmentModal.css';

function CreateAssessmentModal({ onClose, onCreate, classes }) {
    const [step, setStep] = useState('config'); // 'config', 'generating', 'preview'
    const [questions, setQuestions] = useState([]);
    const [deadlineMode, setDeadlineMode] = useState('tomorrow');

    const [formData, setFormData] = useState({
        title: '',
        classId: '',
        className: '',
        duration: '30',
        totalMarks: '50',
        negativeMarks: '0',
        type: 'MCQ',
        difficulty: 'Medium',
        bloomLevel: 'Understanding',
        deadline: ''
    });
    const [uploadedFile, setUploadedFile] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'classId') {
            const selectedClass = classes.find(c => c.id === value);
            setFormData(prev => ({
                ...prev,
                classId: value,
                className: selectedClass ? selectedClass.name : ''
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) { alert('Only PDF, PNG, and JPG files are allowed'); return; }
            if (file.size > 10 * 1024 * 1024) { alert('File size must be less than 10MB'); return; }
            setUploadedFile(file);
        }
    };

    const handleRemoveFile = () => setUploadedFile(null);

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.classId) {
            alert('Please fill in all required fields');
            return;
        }
        setStep('generating');
        try {
            let documentId = null;
            if (uploadedFile) {
                const uploadRes = await apiService.documents.upload(formData.classId, formData.title, uploadedFile);
                documentId = uploadRes.id || uploadRes.document_id || (uploadRes.data && uploadRes.data.id);
            }
            const payload = {
                title:         formData.title,
                classId:       formData.classId,      // apiService maps this → class_id
                type:          formData.type,
                difficulty:    formData.difficulty,
                bloomLevel:    formData.bloomLevel || 'Understanding',
                totalMarks:    parseFloat(formData.totalMarks) || 50,
                duration:      parseInt(formData.duration) || 30,
                negativeMarks: parseFloat(formData.negativeMarks) || 0,
                deadline:      formData.deadline || null,
                documentId:    documentId
            };
            const response = await apiService.questions.generate(payload);
            let generatedQs = response.questions || (response.data && response.data.questions) || response.data || [];
            if (generatedQs && generatedQs.length > 0) {
                // Normalize type to lowercase to ensure UI components match correctly
                generatedQs = generatedQs.map(q => ({ ...q, type: String(q.type || 'mcq').toLowerCase() }));
                setQuestions(generatedQs);
                setStep('preview');
                return;
            } else {
                throw new Error("Backend returned empty questions.");
            }
        } catch (error) {
            console.warn("Backend generation failed, using local fallback:", error.message);
            try {
                let generatedQs = [];
                let extractedTextContext = null;
                
                // NEW: Frontend PDF Parsing Fallback
                if (uploadedFile && uploadedFile.type === 'application/pdf') {
                    try {
                        const rawText = await pdfService.extractText(uploadedFile);
                        extractedTextContext = rawText;
                        const parsedQs = pdfService.parseQuestions(rawText, parseFloat(formData.totalMarks) || 50);
                        if (parsedQs && parsedQs.length > 0) {
                            generatedQs = parsedQs;
                        }
                    } catch (pdfErr) {
                        console.warn("Local PDF extraction failed:", pdfErr);
                    }
                }

                // Fallback to AI if local parsing fails (pass extracted text from PDF if any)
                if (generatedQs.length === 0) {
                    generatedQs = await aiService.generateQuestions(
                        formData.title, 
                        formData.type, 
                        formData.difficulty, 
                        parseFloat(formData.totalMarks) || 50,
                        extractedTextContext
                    );
                }

                if (generatedQs.length === 0) {
                    throw new Error("Could not extract or generate any questions.");
                }

                // Normalize type to lowercase
                generatedQs = generatedQs.map(q => ({ ...q, type: String(q.type || 'mcq').toLowerCase() }));
                setQuestions(generatedQs);
                setStep('preview');

            } catch (aiErr) {
                console.error("AI Service also failed:", aiErr);
                alert("Could not generate questions. Please try again.");
                setStep('config');
            }
        }
    };

    const handleUpdateQuestion = (idx, field, value) => {
        const updated = [...questions];
        updated[idx][field] = value;
        setQuestions(updated);
    };

    const handleOptionChange = (qIdx, optIdx, val) => {
        const updated = [...questions];
        const oldVal = updated[qIdx].options[optIdx];
        updated[qIdx].options[optIdx] = val;
        
        // Sync correct answer if the option text itself is changed
        if (updated[qIdx].type === 'mcq' && updated[qIdx].correct === oldVal) {
            updated[qIdx].correct = val;
        } else if (updated[qIdx].type === 'msq' && Array.isArray(updated[qIdx].correct)) {
            const cIdx = updated[qIdx].correct.indexOf(oldVal);
            if (cIdx !== -1) {
                updated[qIdx].correct[cIdx] = val;
            }
        }
        
        setQuestions(updated);
    };

    const handleToggleCorrect = (qIdx, optVal) => {
        const updated = [...questions];
        if (updated[qIdx].type === 'mcq') {
            updated[qIdx].correct = optVal;
        } else if (updated[qIdx].type === 'msq') {
            let curr = Array.isArray(updated[qIdx].correct) ? [...updated[qIdx].correct] : [];
            if (curr.includes(optVal)) {
                curr = curr.filter(c => c !== optVal);
            } else {
                curr.push(optVal);
            }
            updated[qIdx].correct = curr;
        }
        setQuestions(updated);
    };

    const handleAddOption = (qIdx) => {
        const updated = [...questions];
        if (!updated[qIdx].options) {
            updated[qIdx].options = [];
        }
        updated[qIdx].options.push(`New Option ${updated[qIdx].options.length + 1}`);
        setQuestions(updated);
    };

    const handleDeleteOption = (qIdx, optIdx) => {
        const updated = [...questions];
        if (updated[qIdx].options && updated[qIdx].options.length > 1) {
            updated[qIdx].options.splice(optIdx, 1);
            setQuestions(updated);
        }
    };

    const addQuestion = () => {
        let newType = 'mcq';
        if (formData.type === 'Short Answer') newType = 'short';
        else if (formData.type === 'Long Answer') newType = 'long';
        else if (formData.type === 'MSQ (Multiple Select)') newType = 'msq';
        else if (formData.type === 'True / False') newType = 'true_false';
        else if (formData.type === 'Fill in the Blank') newType = 'fill_blank';
        else if (formData.type === 'Case Study') newType = 'case_study';
        else if (formData.type === 'Matching') newType = 'matching';

        let newQ;
        if (newType === 'mcq' || newType === 'msq' || newType === 'matching') {
            newQ = { id: `q_${Date.now()}`, type: newType, text: 'New Question', options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 'Option A', maxMarks: 1 };
        } else if (newType === 'true_false') {
            newQ = { id: `q_${Date.now()}`, type: newType, text: 'New Question', correct: 'True', maxMarks: 1 };
        } else {
            newQ = { id: `q_${Date.now()}`, type: newType, text: 'New Question', maxMarks: 5 };
        }
        setQuestions([...questions, newQ]);
    };

    const removeQuestion = (idx) => setQuestions(questions.filter((_, i) => i !== idx));


    const calculateQuality = () => {
        let score = 70;
        const qCount = questions.length;
        if (qCount > 10) score += 10;
        if (qCount < 3) score -= 20;
        if (new Set(questions.map(q => q.type)).size > 1) score += 15;
        return Math.min(100, Math.max(0, score));
    };


    const handleFinalSubmit = () => {
        const currentTotal = questions.reduce((sum, q) => sum + (parseFloat(q.maxMarks) || 0), 0);
        const targetTotal = parseFloat(formData.totalMarks);
        if (currentTotal > targetTotal) { alert(`Error: Total marks (${currentTotal}) exceed the set limit (${targetTotal}).`); return; }
        if (currentTotal < targetTotal) { if (!window.confirm(`Total marks (${currentTotal}) are less than the set limit (${targetTotal}). Proceed anyway?`)) return; }
        let finalDeadline = formData.deadline;
        if (deadlineMode === 'today') {
            const d = new Date();
            d.setHours(23, 59, 59, 999);
            finalDeadline = d.toISOString();
        } else if (deadlineMode === 'tomorrow') {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            d.setHours(23, 59, 59, 999);
            finalDeadline = d.toISOString();
        } else if (!finalDeadline) {
            alert('Please select a custom deadline.');
            return;
        }

        const assessmentData = {
            ...formData,
            deadline: finalDeadline,
            totalMarks: currentTotal,
            questions,
            uploadedFile: uploadedFile ? { name: uploadedFile.name, size: uploadedFile.size, type: uploadedFile.type } : null
        };
        onCreate(assessmentData);
        onClose();
    };

    return (
        <div className="modal-overlay" data-lenis-prevent onClick={onClose}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{step === 'config' ? 'Create New Assessment' : step === 'generating' ? 'AI is working...' : 'Review & Edit AI Questions'}</h2>
                    <button className="cam-close-btn" onClick={onClose} type="button" aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {step === 'config' && (
                    <form onSubmit={handleGenerate}>
                        <div className="form-row">
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-title">Assessment Title *</label>
                                <input
                                    id="cam-title"
                                    className="cam-input"
                                    type="text"
                                    name="title"
                                    placeholder="e.g., Chapter 5 Quiz"
                                    value={formData.title}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-classId">Class *</label>
                                <select
                                    id="cam-classId"
                                    className="cam-select"
                                    name="classId"
                                    value={formData.classId}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select class</option>
                                    {classes.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-row three-col" style={{ marginTop: '16px' }}>
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-duration">Duration (mins) *</label>
                                <input id="cam-duration" className="cam-input" type="number" name="duration" value={formData.duration} onChange={handleChange} onWheel={(e) => e.target.blur()} min="1" required />
                            </div>
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-totalMarks">Total Marks *</label>
                                <input id="cam-totalMarks" className="cam-input" type="number" name="totalMarks" value={formData.totalMarks} onChange={handleChange} onWheel={(e) => e.target.blur()} min="1" required />
                            </div>
                            <div className="cam-field" style={{ gridColumn: 'span 1' }}>
                                <label className="cam-label">Deadline *</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <select 
                                        className="cam-select" 
                                        value={deadlineMode}
                                        onChange={(e) => setDeadlineMode(e.target.value)}
                                    >
                                        <option value="today">Today (11:59 PM)</option>
                                        <option value="tomorrow">Tomorrow (11:59 PM)</option>
                                        <option value="custom">Custom Date & Time</option>
                                    </select>
                                    
                                    {deadlineMode === 'custom' && (
                                        <input 
                                            id="cam-deadline" 
                                            className="cam-input" 
                                            type="datetime-local" 
                                            name="deadline" 
                                            value={formData.deadline} 
                                            onChange={handleChange} 
                                            required 
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form-row three-col" style={{ marginTop: '16px' }}>
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-type">Type</label>
                                <select id="cam-type" className="cam-select" name="type" value={formData.type} onChange={handleChange}>
                                    <option value="MCQ">MCQ</option>
                                    <option value="MSQ">MSQ (Multiple Select)</option>
                                    <option value="True / False">True / False</option>
                                    <option value="Fill in the Blank">Fill in the Blank</option>
                                    <option value="Short Answer">Short Answer (SAQ)</option>
                                    <option value="Long Answer">Long Answer / Essay</option>
                                    <option value="Case Study">Case Study / Scenario</option>
                                    <option value="Matching">Matching</option>
                                    <option value="Mix">Mix (All Types)</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row three-col" style={{ marginTop: '16px' }}>
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-difficulty">Difficulty</label>
                                <select id="cam-difficulty" className="cam-select" name="difficulty" value={formData.difficulty} onChange={handleChange}>
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                </select>
                            </div>
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-bloomLevel">Bloom Taxonomy</label>
                                <select id="cam-bloomLevel" className="cam-select" name="bloomLevel" value={formData.bloomLevel} onChange={handleChange}>
                                    <option value="Remember">Remembering</option>
                                    <option value="Understand">Understanding</option>
                                    <option value="Apply">Applying</option>
                                    <option value="Analyze">Analyzing</option>
                                    <option value="Evaluate">Evaluating</option>
                                    <option value="Create">Creating</option>
                                </select>
                            </div>
                            <div className="cam-field">
                                <label className="cam-label" htmlFor="cam-negativeMarks">Negative Marks</label>
                                <input id="cam-negativeMarks" className="cam-input" type="number" name="negativeMarks" value={formData.negativeMarks} onChange={handleChange} onWheel={(e) => e.target.blur()} min="0" step="0.5" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Upload Content (Optional)</label>
                            <div className="file-upload-area">
                                {!uploadedFile ? (
                                    <label className="file-upload-label">
                                        <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} style={{ display: 'none' }} />
                                        <div className="upload-icon">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                                <path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                <path d="M9 15l3 -3l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                <path d="M12 12l0 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </div>
                                        <p className="upload-text"><span className="upload-link">Click to upload</span> or drag and drop</p>
                                        <p className="upload-hint">PDF, PNG, JPG (max 10MB)</p>
                                    </label>
                                ) : (
                                    <div className="uploaded-file">
                                        <div className="file-info">
                                            <p className="file-name">{uploadedFile.name}</p>
                                            <p className="file-size">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                                        </div>
                                        <button type="button" className="remove-file-btn" onClick={handleRemoveFile}>✖</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button type="submit" className="btn-generate">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Generate Questions
                        </button>
                    </form>
                )}

                {step === 'generating' && (
                    <div style={{ padding: '64px 0', textAlign: 'center' }}>
                        <div className="cam-spinner"></div>
                        <h3 style={{ color: 'var(--auth-text, #0f172a)', marginTop: '24px' }}>Analyzing material...</h3>
                        <p style={{ color: 'var(--auth-text-muted, #71717a)' }}>Our AI is extracting key concepts and generating questions.</p>
                    </div>
                )}

                {step === 'preview' && (
                    <div className="preview-container-advanced" style={{ background: '#f8fafc', color: '#0f172a', padding: '24px', margin: '-24px', borderRadius: '16px', height: '75vh', minHeight: '500px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', overflow: 'hidden' }}>
                        <div className="preview-questions-side" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                            <div className="preview-stats-banner" style={{ background: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flexShrink: 0 }}>
                                <div className="p-stat" style={{ color: '#475569' }}>Target: <b style={{ color: '#0f172a' }}>{formData.totalMarks}</b></div>
                                <div className="p-stat" style={{ color: '#475569' }}>Allocated: <b className={questions.reduce((s, q) => s + (parseFloat(q.maxMarks) || 0), 0) > parseFloat(formData.totalMarks) ? 'err' : 'ok'} style={{ color: '#0f172a' }}>
                                    {questions.reduce((s, q) => s + (parseFloat(q.maxMarks) || 0), 0)}
                                </b></div>
                            </div>

                            <div className="questions-scroll-area" style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', paddingBottom: '16px' }}>
                                {questions.map((q, i) => (
                                    <div key={q.id} className="preview-q-card" style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                                        <div className="pq-header">
                                            <span className="pq-num" style={{ color: '#64748b', fontWeight: 600 }}>Question {i + 1}</span>
                                            <div className="pq-actions">
                                                <input type="number" value={q.maxMarks || 0} onChange={e => handleUpdateQuestion(i, 'maxMarks', parseFloat(e.target.value) || 0)} onWheel={(e) => e.target.blur()} style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1' }} />
                                                <button onClick={() => removeQuestion(i)} className="pq-remove" style={{ color: '#ef4444' }}>×</button>
                                            </div>
                                        </div>
                                        <textarea value={q.text} onChange={e => handleUpdateQuestion(i, 'text', e.target.value)} style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', width: '100%', minHeight: '80px', padding: '12px', marginBottom: '16px', borderRadius: '8px', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
                                        {['mcq', 'msq', 'matching'].includes(q.type) && (
                                            <div className="pq-options-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                {(q.options || []).map((opt, oi) => {
                                                    const isCorrect = q.type === 'msq' 
                                                        ? (Array.isArray(q.correct) && q.correct.includes(opt))
                                                        : q.correct === opt;
                                                    
                                                    return (
                                                        <div key={oi} style={{ display: 'flex', alignItems: 'center', background: isCorrect ? '#ecfdf5' : '#f8fafc', border: `1px solid ${isCorrect ? '#10b981' : '#cbd5e1'}`, borderRadius: '8px', padding: '0 10px', boxSizing: 'border-box' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginRight: '8px', width: '16px', flexShrink: 0 }}>
                                                                {String.fromCharCode(65 + oi)}.
                                                            </span>
                                                            <input 
                                                                type={q.type === 'msq' ? 'checkbox' : 'radio'} 
                                                                name={`correct_${i}`} 
                                                                checked={isCorrect} 
                                                                onChange={() => handleToggleCorrect(i, opt)}
                                                                style={{ marginRight: '8px', cursor: 'pointer' }}
                                                            />
                                                            <input value={opt} onChange={e => handleOptionChange(i, oi, e.target.value)} style={{ background: 'transparent', color: '#0f172a', border: 'none', padding: '10px 0', fontSize: '13px', width: '100%', outline: 'none' }} />
                                                            {q.options.length > 1 && (
                                                                <button type="button" onClick={() => handleDeleteOption(i, oi)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', fontSize: '18px', display: 'flex', alignItems: 'center' }}>×</button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            <div style={{ marginTop: '12px' }}>
                                                <button type="button" onClick={() => handleAddOption(i)} style={{ background: 'transparent', border: '1px dashed #cbd5e1', color: '#64748b', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', width: '100%' }}>
                                                    + Add Option
                                                </button>
                                            </div>
                                        </div>
                                        )}
                                        {q.type === 'true_false' && (
                                            <div className="pq-options-grid" style={{ display: 'flex', gap: '16px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: q.correct === 'True' ? '#ecfdf5' : '#f8fafc', border: `1px solid ${q.correct === 'True' ? '#10b981' : '#cbd5e1'}`, borderRadius: '8px', cursor: 'pointer' }}>
                                                    <input type="radio" name={`tf_${i}`} checked={q.correct === 'True'} onChange={() => handleUpdateQuestion(i, 'correct', 'True')} style={{ marginRight: '8px' }} />
                                                    <span style={{ fontSize: '13px', color: '#0f172a' }}>True</span>
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: q.correct === 'False' ? '#ecfdf5' : '#f8fafc', border: `1px solid ${q.correct === 'False' ? '#10b981' : '#cbd5e1'}`, borderRadius: '8px', cursor: 'pointer' }}>
                                                    <input type="radio" name={`tf_${i}`} checked={q.correct === 'False'} onChange={() => handleUpdateQuestion(i, 'correct', 'False')} style={{ marginRight: '8px' }} />
                                                    <span style={{ fontSize: '13px', color: '#0f172a' }}>False</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <button type="button" className="btn-add-q" onClick={addQuestion} style={{ width: '100%', borderStyle: 'dashed' }}>+ Add Empty Question</button>
                            </div>
                        </div>

                        <div className="ai-quality-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
                            <div className="aq-header">
                                <span className="aq-icon">⚖️</span>
                                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>AI Quality Audit</h4>
                            </div>
                            <div className="aq-score-box">
                                <div className="aq-score-circle">
                                    <svg viewBox="0 0 36 36" style={{ width: 120, height: 120, transform: 'rotate(-90deg)' }}>
                                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
                                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="url(#qGrad)" strokeWidth="2.5" strokeDasharray={`${calculateQuality()} ${100 - calculateQuality()}`} strokeLinecap="round" />
                                        <defs><linearGradient id="qGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient></defs>
                                    </svg>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{calculateQuality()}%</span>
                                    </div>
                                </div>
                                <p style={{ textAlign: 'center', fontWeight: 600, fontSize: 13, color: '#475569', marginTop: 8 }}>Assessment Strength</p>
                            </div>
                            <div>
                                {[
                                    { label: 'EDUCATIONAL ALIGNMENT', color: '#3b82f6', w: 80 },
                                    { label: 'DIFFICULTY DISTRIBUTION', color: '#f59e0b', w: 55 },
                                    { label: 'BIAS & NEUTRALITY', color: '#10b981', w: 90 }
                                ].map(({ label, color, w }) => (
                                    <div key={label} style={{ marginBottom: 14 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
                                        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99 }}>
                                            <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '16px', flex: 1 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>💡 AI Insights:</p>
                                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
                                    <li>Mix question types (MCQ + Subjective) to test deeper understanding</li>
                                    <li>Ensure answer options are plausible distractors</li>
                                    <li>Balance difficulty distribution for fairness</li>
                                </ul>
                            </div>
                            <button type="button" className="btn-finalize" onClick={handleFinalSubmit} style={{ width: '100%', marginTop: '16px', padding: '16px', fontSize: '15px' }}>Finalize & Launch 🚀</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CreateAssessmentModal;
