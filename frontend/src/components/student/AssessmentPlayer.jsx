import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Timer,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  AlertCircle,
  Flag
} from 'lucide-react'
import apiService from '../../services/apiService'
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision"

export default function AssessmentPlayer({ assessment, onExit, onSubmit }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [answers, setAnswersState] = useState({})
    const [flagged, setFlagged] = useState({})
    const answersRef = useRef({})
    
    const setAnswers = (newVal) => {
        answersRef.current = newVal;
        setAnswersState(newVal);
    }
    const [timeLeft, setTimeLeft] = useState((assessment.duration || 30) * 60)
    const isSubmittingRef = useRef(false)

    // --- PROCTORING STATE ---
    const isStrictProctoring = !assessment.isSelfGeneratedMock;
    const videoRef = useRef(null);
    const faceDetectorRef = useRef(null);
    const requestAnimationFrameId = useRef(null);
    const [warnings, setWarnings] = useState(0);
    const [proctorLogs, setProctorLogs] = useState([]);
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [warningMessage, setWarningMessage] = useState("");
    const [cameraReady, setCameraReady] = useState(false);
    const lastDetectionTimeRef = useRef(0);
    const violationStartRef = useRef(null);

    const logViolation = (message) => {
        if (isSubmittingRef.current) return;
        setWarnings(prev => {
            const next = prev + 1;
            setProctorLogs(logs => [...logs, { time: new Date().toLocaleTimeString(), event: message, severity: 'high' }]);
            
            if (next >= 3) {
                // Auto submit if threshold reached
                alert("Security Violation: You have exceeded the maximum number of warnings. The test will now be submitted.");
                handleFinalSubmit();
            } else {
                setWarningMessage(message);
                setShowWarningModal(true);
            }
            return next;
        });
    };

    // --- LIFECYCLE & PROCTORING SETUP ---
    useEffect(() => {
        // Start assessment delivery
        const startDelivery = async () => {
            try {
                if (!assessment.isSelfGeneratedMock) {
                    await apiService.questions.assessments.delivery.start(assessment.id);
                }
            } catch (e) {
                console.warn("API delivery.start failed, using local mode", e);
            }
        };
        startDelivery();

        let saveCounter = 0;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timer); handleFinalSubmit(); return 0; }
                return prev - 1;
            });
            
            saveCounter++;
            if (saveCounter >= 60 && !assessment.isSelfGeneratedMock) {
                saveCounter = 0;
                apiService.questions.assessments.delivery.save(assessment.id, { answers: answersRef.current }).catch(e => {
                    console.warn("API delivery.save failed", e);
                });
            }
        }, 1000);

        // Setup Proctoring
        let stream = null;
        if (isStrictProctoring) {
            // 1. Fullscreen
            const goFullscreen = async () => {
                try {
                    await document.documentElement.requestFullscreen();
                } catch (e) {
                    console.warn("Fullscreen request failed", e);
                }
            };
            goFullscreen();

            const handleFullscreenChange = () => {
                if (!document.fullscreenElement) {
                    logViolation("Exited fullscreen mode.");
                }
            };
            document.addEventListener('fullscreenchange', handleFullscreenChange);

            // 2. Tab Switching
            const handleVisibilityChange = () => {
                if (document.hidden) {
                    logViolation("Switched tabs or minimized browser.");
                }
            };
            document.addEventListener('visibilitychange', handleVisibilityChange);

            // 3. Camera & AI Face Detection
            const setupCamera = async () => {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }

                    // Load MediaPipe
                    const vision = await FilesetResolver.forVisionTasks(
                        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
                    );
                    faceDetectorRef.current = await FaceDetector.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
                            delegate: "CPU"
                        },
                        runningMode: "VIDEO"
                    });
                    
                    // Tell the loop that both the camera and AI are fully ready
                    setCameraReady(true);
                } catch (e) {
                    console.error("Camera/MediaPipe init failed", e);
                    logViolation("Camera access denied or AI initialization failed.");
                }
            };
            setupCamera();

            return () => {
                clearInterval(timer);
                document.removeEventListener('fullscreenchange', handleFullscreenChange);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                if (requestAnimationFrameId.current) {
                    cancelAnimationFrame(requestAnimationFrameId.current);
                }
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(e => console.warn(e));
                }
            };
        }

        return () => {
            clearInterval(timer);
        };
    }, []);

    // Continuous Face Detection Loop
    useEffect(() => {
        if (!isStrictProctoring || !cameraReady || !faceDetectorRef.current || !videoRef.current) return;

        const detectFace = () => {
            const video = videoRef.current;
            if (video && video.readyState >= 2 && video.currentTime !== lastDetectionTimeRef.current) {
                lastDetectionTimeRef.current = video.currentTime;
                
                try {
                    const detections = faceDetectorRef.current.detectForVideo(video, performance.now());
                    const faceCount = detections.detections.length;

                    if (faceCount !== 1) {
                        if (!violationStartRef.current) {
                            violationStartRef.current = Date.now();
                        } else if (Date.now() - violationStartRef.current > 1500) { // 1.5 seconds of continuous violation
                            logViolation(faceCount === 0 ? "No face detected in webcam." : "Multiple faces detected.");
                            violationStartRef.current = null; // Reset after logging
                        }
                    } else {
                        violationStartRef.current = null;
                    }
                } catch (e) {
                    console.warn("Detection error", e);
                }
            }
            requestAnimationFrameId.current = requestAnimationFrame(detectFace);
        };

        requestAnimationFrameId.current = requestAnimationFrame(detectFace);

        return () => {
            if (requestAnimationFrameId.current) {
                cancelAnimationFrame(requestAnimationFrameId.current);
            }
        }
    }, [cameraReady, isStrictProctoring]);


    const handleFinalSubmit = async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(e => console.warn(e));
        }

        const objectiveTypes = ['mcq', 'msq', 'true_false', 'true/false'];
        const objectiveQuestions = (assessment.questions || []).filter(q => objectiveTypes.includes(q.type));
        const subjectiveQuestions = (assessment.questions || []).filter(q => !objectiveTypes.includes(q.type));

        let mcqScore = 0;
        objectiveQuestions.forEach(q => {
            const qId = q.id;
            const studentAns = answersRef.current[qId];
            if (!studentAns) return;

            if (q.type === 'msq') {
                let correctArr = Array.isArray(q.correct || q.correct_answer || q.correctAnswers) ? (q.correct || q.correct_answer || q.correctAnswers) : [q.correct || q.correct_answer || q.correctAnswers].filter(Boolean);
                let studentArr = Array.isArray(studentAns) ? studentAns : [studentAns].filter(Boolean);
                if (correctArr.length === studentArr.length && correctArr.every(v => studentArr.includes(v))) {
                    mcqScore += (parseFloat(q.maxMarks || q.marks) || 0);
                }
            } else {
                const correct = q.correct || q.correct_answer || q.correctAnswer;
                if (correct && String(studentAns).trim().toLowerCase() === String(correct).trim().toLowerCase()) {
                    mcqScore += (parseFloat(q.maxMarks || q.marks) || 0);
                }
            }
        });

        const mcqTotal = objectiveQuestions.reduce((s, q) => s + (parseFloat(q.maxMarks || q.marks) || 0), 0);
        const manualTotal = subjectiveQuestions.reduce((s, q) => s + (parseFloat(q.maxMarks || q.marks) || 0), 0);

        const payload = {
            assessmentId: assessment.id,
            assessmentTitle: assessment.title,
            answers: answersRef.current,
            mcqScore,
            mcqTotal,
            manualTotal,
            percentage: Math.round((mcqScore / Math.max(1, mcqTotal + manualTotal)) * 100),
            proctorLogs: isStrictProctoring ? proctorLogs : undefined
        };

        onSubmit(payload);
    }

    const questions = assessment.questions || []
    if (questions.length === 0) {
        return (
            <div className="lumina-assessment-player">
                <header className="lap-header">
                    <div className="lap-header-left"><h3>{assessment.title}</h3></div>
                </header>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                    <p>This assessment has no questions yet.</p>
                </div>
            </div>
        )
    }

    const currentQ = questions[currentIndex]
    const currentQId = currentQ.id || `q_${currentIndex + 1}`
    const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

    return (
        <div className="lumina-assessment-player">
            <header className="lap-header">
                <div className="lap-header-left">
                    <h3 style={{ fontSize: 24, fontWeight: 800 }}>{assessment.title}</h3>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{assessment.className || 'General'}</div>
                </div>
                <div className="lap-timer">
                    <Timer size={24} style={{ marginRight: 8 }} />
                    <span>{formatTime(timeLeft)}</span>
                </div>
            </header>

            <div className="lap-main">
                <aside className="lap-navigator">
                    {/* CAMERA PREVIEW */}
                    {isStrictProctoring && (
                        <div style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--lumina-border)', background: '#000', position: 'relative' }}>
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                style={{ width: '100%', height: 'auto', display: 'block', transform: 'scaleX(-1)' }} 
                            />
                            {!cameraReady && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#666' }}>
                                    Starting Camera...
                                </div>
                            )}
                            <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 4, fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} /> Live Proctoring
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h4 style={{ margin: 0, fontSize: 14 }}>Navigator</h4>
                        <span style={{ fontSize: 12, opacity: 0.6 }}>{questions.length} Questions</span>
                    </div>
                    <div className="lap-q-grid">
                        {questions.map((q, i) => {
                            const qId = q.id || `q_${i + 1}`;
                            const isFlagged = flagged[qId];
                            return (
                                <button
                                    key={i}
                                    onClick={() => setCurrentIndex(i)}
                                    className={`lap-q-dot ${currentIndex === i ? 'active' : ''} ${answers[qId] ? 'filled' : ''}`}
                                    style={isFlagged ? { border: '2px solid #f59e0b', color: '#f59e0b' } : {}}
                                >
                                    {i + 1}
                                </button>
                            );
                        })}
                    </div>
                    
                    <div style={{ marginTop: 'auto', paddingTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
                            <span style={{ fontSize: 11, opacity: 0.7 }}>Answered</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--lumina-teal)', border: '1px solid var(--lumina-border)' }} />
                            <span style={{ fontSize: 11, opacity: 0.7 }}>Current</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--lumina-border)' }} />
                            <span style={{ fontSize: 11, opacity: 0.7 }}>Unanswered</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '2px solid #f59e0b' }} />
                            <span style={{ fontSize: 11, opacity: 0.7 }}>Flagged</span>
                        </div>
                    </div>
                </aside>

                <main className="lap-content">
                    <div className="lap-q-area" style={{ maxWidth: 900, margin: '0 auto' }}>
                        <div className="lap-q-meta">QUESTION {currentIndex + 1} OF {questions.length}</div>
                        <h2 className="lap-q-text">{currentQ.text || currentQ.question_text}</h2>

                        <div className="lap-input-area">
                            {['mcq', 'true_false', 'true/false'].includes(currentQ.type) ? (
                                <div className="lap-options">
                                    {(currentQ.options || (['true_false', 'true/false'].includes(currentQ.type) ? ['True', 'False'] : [])).map((opt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setAnswers({ ...answers, [currentQId]: opt })}
                                            className={`lap-opt-btn ${answers[currentQId] === opt ? 'selected' : ''}`}
                                        >
                                            <div className="lap-opt-label">{String.fromCharCode(65 + i)}</div>
                                            <div style={{ flex: 1 }}>{opt}</div>
                                        </button>
                                    ))}
                                </div>
                            ) : currentQ.type === 'msq' ? (
                                <div className="lap-options">
                                    {(currentQ.options || []).map((opt, i) => {
                                        const isSelected = (answers[currentQId] || []).includes(opt);
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    const currArr = Array.isArray(answers[currentQId]) ? answers[currentQId] : [];
                                                    const newArr = isSelected ? currArr.filter(v => v !== opt) : [...currArr, opt];
                                                    setAnswers({ ...answers, [currentQId]: newArr });
                                                }}
                                                className={`lap-opt-btn ${isSelected ? 'selected' : ''}`}
                                            >
                                                <div className="lap-opt-label" style={{ borderRadius: 4 }}>{isSelected ? '✓' : ''}</div>
                                                <div style={{ flex: 1 }}>{opt}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : currentQ.type === 'matching' ? (
                                <div className="lap-matching-container">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                                        {/* Left Column */}
                                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Items to Match</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {(() => {
                                                    const opts = currentQ.options || [];
                                                    const mid = Math.ceil(opts.length / 2);
                                                    return opts.slice(0, mid).map((opt, i) => (
                                                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--lumina-teal)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                                                                {i + 1}
                                                            </div>
                                                            <div style={{ fontSize: '14px', color: '#334155' }}>{opt}</div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                        
                                        {/* Right Column */}
                                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Options</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {(() => {
                                                    const opts = currentQ.options || [];
                                                    const mid = Math.ceil(opts.length / 2);
                                                    return opts.slice(mid).map((opt, i) => (
                                                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--lumina-purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                                                                {String.fromCharCode(65 + i)}
                                                            </div>
                                                            <div style={{ fontSize: '14px', color: '#334155' }}>{opt}</div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#334155' }}>Your Answers</h4>
                                    <textarea
                                        placeholder="Type your matches here (e.g., 1 -> A, 2 -> C)"
                                        value={answers[currentQId] || ''}
                                        onChange={e => setAnswers({ ...answers, [currentQId]: e.target.value })}
                                        className="lap-textarea"
                                        style={{ height: '100px' }}
                                    />
                                </div>
                            ) : (
                                <textarea
                                    placeholder="Type your detailed response here..."
                                    value={answers[currentQId] || ''}
                                    onChange={e => setAnswers({ ...answers, [currentQId]: e.target.value })}
                                    className="lap-textarea"
                                />
                            )}
                        </div>

                        <div className="lap-controls">
                            <button 
                                disabled={currentIndex === 0} 
                                onClick={() => setCurrentIndex(currentIndex - 1)} 
                                className="lap-btn-nav"
                            >
                                <ChevronLeft size={18} /> Previous
                            </button>
                            <button 
                                className="lap-btn-nav"
                                onClick={() => setFlagged(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))}
                                style={flagged[currentQ.id] ? { color: '#f59e0b', borderColor: '#f59e0b', background: 'rgba(245,158,11,0.1)' } : {}}
                            >
                                <Flag size={18} style={{ marginRight: 6 }} /> {flagged[currentQ.id] ? 'Unflag' : 'Flag for Review'}
                            </button>
                            <button 
                                onClick={() => {
                                    if (currentIndex === questions.length - 1) handleFinalSubmit()
                                    else setCurrentIndex(currentIndex + 1)
                                }} 
                                className="lap-btn-nav lap-btn-next"
                                style={{ marginLeft: 'auto' }}
                            >
                                {currentIndex === questions.length - 1 ? 'Submit Test' : <>Next <ChevronRight size={18} /></>}
                            </button>
                        </div>
                    </div>
                </main>
            </div>

            {/* PROCTORING WARNING MODAL */}
            {showWarningModal && (
                <div className="warning-overlay">
                    <div className="warning-card">
                        <AlertCircle size={64} color="#f43f5e" style={{ marginBottom: 20 }} />
                        <h2 style={{ color: '#f43f5e', margin: '0 0 16px' }}>SECURITY WARNING</h2>
                        <p style={{ color: '#dfe2f1', marginBottom: 24, fontSize: 16 }}>
                            {warningMessage}
                        </p>
                        <p style={{ color: '#ffb4ab', fontWeight: 'bold', fontSize: 18 }}>
                            Warning: {warnings} / 3
                        </p>
                        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 12 }}>
                            {warnings >= 2 
                                ? "One more violation and your test will be automatically submitted." 
                                : "Please maintain focus on your screen."}
                        </p>
                        <button 
                            className="lp-btn-primary" 
                            style={{ marginTop: 24, width: '100%', padding: '12px', background: '#ef4444', border: 'none', borderRadius: 8, color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                            onClick={() => {
                                setShowWarningModal(false);
                                // Ensure fullscreen is reclaimed if they exited it
                                if (!document.fullscreenElement) {
                                    document.documentElement.requestFullscreen().catch(e => console.warn(e));
                                }
                            }}
                        >
                            I Understand
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
