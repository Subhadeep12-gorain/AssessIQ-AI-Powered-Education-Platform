import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './StudentDashboard.css'
import '../../styles/DashboardStyles.css'
import DashboardLayout from '../../components/DashboardLayout'
import AssessmentPlayer from '../../components/student/AssessmentPlayer'
import MockExamModal from '../../components/modals/MockExamModal'
import apiService from '../../services/apiService'
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  ClipboardList,
  ShieldCheck,
  Target,
  Zap,
  Flame,
  Search,
  ArrowRight,
  TrendingUp,
  X,
  Play,
  LogOut,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Timer,
  Info,
  BrainCircuit,
  AlertCircle
} from 'lucide-react'

export default function StudentDashboard({ user, onLogout, onUserUpdate }) {
    const [activeTab, setActiveTab] = useState('dashboard')
    const [results, setResults] = useState([])
    const [pendingMissions, setPendingMissions] = useState([])
    const [showStatsModal, setShowStatsModal] = useState(false)
    const [allStudentAssessments, setAllStudentAssessments] = useState([])
    const [enrolledClasses, setEnrolledClasses] = useState([])
    const [activeAssessment, setActiveAssessment] = useState(null)
    const [showMockModal, setShowMockModal] = useState(false)
    const [mockResults, setMockResults] = useState([])
    const [activityInsights, setActivityInsights] = useState([])
    const joinCodeInputRef = useRef(null)

    const studentNav = [
        { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { key: 'classes', icon: BookOpen, label: 'My Classes' },
        { key: 'assessments', icon: ClipboardList, label: 'Assessments' },
        { key: 'results', icon: ShieldCheck, label: 'My Results' },
    ]

    const loadData = async () => {
        try {
            // Fetch classes from backend
            let apiClasses = [];
            try {
                const res = await apiService.courses.my();
                if (res) apiClasses = res.map(c => ({ ...c, name: c.name }));
            } catch (e) {
                console.warn("API my classes failed:", e);
            }
            setEnrolledClasses(apiClasses);

            // Fetch assessments from backend
            let apiAssessments = [];
            try {
                const res = await apiService.questions.assessments.my();
                if (res) apiAssessments = res;
            } catch(e) {
                console.warn("API my assessments failed:", e);
            }
            
            // Fetch submissions from backend
            let apiSubmissions = [];
            try {
                const res = await apiService.questions.submissions.list({ student_id: user.id });
                if (res) apiSubmissions = res;
            } catch(e) {
                console.warn("API submissions failed:", e);
            }

            const derivedResults = apiSubmissions.map(s => ({
                submissionId: s.id,
                assessmentId: s.quiz_id ?? s.assessmentId,
                assessmentTitle: s.assessmentTitle || allStudentAssessments.find(a => String(a.id) === String(s.quiz_id))?.title || 'Assessment',
                mcqScore: s.mcq_score || 0,
                mcqTotal: s.mcq_total || 0,
                manualTotal: s.manual_total || 0,
                manualScore: s.manual_score || 0,
                percentage: s.percentage || 0,
                pending: s.status === 'submitted' || s.status === 'pending' || !s.status,
                status: s.status,
                date: new Date(s.submitted_at || s.created_at || Date.now()).toLocaleDateString()
            }));


            const pending = apiAssessments.filter(a => {
                const isDone = derivedResults.find(r => String(r.assessmentId) === String(a.id));
                const isExpired = a.deadline && new Date() > new Date(a.deadline);
                return !isDone && !isExpired;
            });

            setResults(derivedResults);
            setPendingMissions(pending);
            setAllStudentAssessments(apiAssessments);

            // Fetch Mock Submissions from local storage (these are self-generated so they stay local for now)
            const localMockSubmissions = JSON.parse(localStorage.getItem('student_mock_submissions') || '[]');
            const myMockSubmissions = localMockSubmissions.filter(s => String(s.studentEmail).toLowerCase() === String(user.email).toLowerCase());
            
            const derivedMockResults = myMockSubmissions.map(s => ({
                submissionId: s.id,
                assessmentId: s.assessmentId,
                assessmentTitle: s.assessmentTitle || 'AI Practice Test',
                mcqScore: s.mcqScore || 0,
                mcqTotal: s.mcqTotal || 0,
                manualTotal: s.manualTotal || 0,
                manualScore: s.manualScore || 0,
                percentage: s.percentage || 0,
                date: new Date(s.createdAt || Date.now()).toLocaleDateString()
            }));
            
            setMockResults(derivedMockResults);

        } catch (e) {
            console.error('Data load error', e);
        }
    };

    useEffect(() => {
        if (user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            loadData()
            window.addEventListener('storage', loadData)
            return () => window.removeEventListener('storage', loadData)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    useEffect(() => {
        const insights = [];

        // 1. Pending Missions Alert
        if (pendingMissions.length > 0) {
            insights.push({
                id: 'pending',
                icon: <AlertCircle size={20} />,
                color: 'var(--lumina-red, #ef4444)',
                text: `You have ${pendingMissions.length} active assessment${pendingMissions.length > 1 ? 's' : ''} pending.`
            });
        }

        // 2. Performance Trend
        if (results.length >= 2) {
            const recent = results.slice(0, 3);
            const avgRecent = recent.reduce((sum, r) => sum + (r.percentage || 0), 0) / recent.length;
            
            insights.push({
                id: 'trend',
                icon: avgRecent >= 70 ? <TrendingUp size={20} /> : <BrainCircuit size={20} />,
                color: avgRecent >= 70 ? 'var(--lumina-teal, #10b981)' : 'var(--lumina-orange, #f59e0b)',
                text: `Your recent average score is ${Math.round(avgRecent)}%. ${avgRecent >= 70 ? 'Keep up the great work!' : 'Consider reviewing past material.'}`
            });
        } else if (results.length === 1) {
            insights.push({
                id: 'trend',
                icon: <Zap size={20} />,
                color: 'var(--lumina-purple, #8b5cf6)',
                text: `You completed your first assessment with a score of ${Math.round(results[0].percentage || 0)}%.`
            });
        }

        if (insights.length === 0) {
            insights.push({
                id: 'welcome',
                icon: <BrainCircuit size={20} />,
                color: 'var(--lumina-purple, #8b5cf6)',
                text: 'Complete your first assessment to unlock personalized insights.'
            });
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActivityInsights(insights);
    }, [results, pendingMissions]);

    const handleJoinClass = async () => {
        const code = (joinCodeInputRef.current?.value || '').trim()
        if (!code) { alert('Please enter a class code.'); return }
        try {
            await apiService.courses.enroll(code);
            if (joinCodeInputRef.current) joinCodeInputRef.current.value = '';
            alert('Successfully joined the class!');
            loadData();
        } catch (err) {
            console.error("Failed to join class", err);
            alert(err.message || 'Failed to join class.');
        }
    }

    const handleLeaveClass = (e, classId) => {
        e.stopPropagation()
        if (!window.confirm('Are you sure you want to leave this class?')) return
        const key = `classes_${user.email}`
        const existing = JSON.parse(localStorage.getItem(key) || '[]')
        localStorage.setItem(key, JSON.stringify(existing.filter(c => String(c.id) !== String(classId))))
        loadData()
    }

    const handleDownloadReport = () => {
        if (results.length === 0) {
            alert('No results available to download.');
            return;
        }

        const headers = ['Assessment Title', 'MCQ Score', 'MCQ Total', 'Percentage', 'Date'];
        const csvContent = [
            headers.join(','),
            ...results.map(r => `"${r.assessmentTitle}",${r.mcqScore},${r.mcqTotal},${r.percentage}%,${r.date}`)
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `student_report_${(user?.name || 'user').replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleStartTest = async (assessment) => {
        try {
            let fullAssessment = { ...assessment };
            if (!assessment.questions || assessment.questions.length === 0) {
                const res = await apiService.questions.assessments.get(assessment.id);
                if (res) {
                    fullAssessment = { ...assessment, ...res };
                }
            }

            const rawQuestions = fullAssessment.questions || [];
            const normalizedQuestions = rawQuestions.map((q, idx) => ({
                id: q.id || `q_${idx + 1}`,
                text: q.text || q.question_text || '',
                type: (q.type || 'mcq').toLowerCase().replace('/', '_'),
                options: q.options || [],
                marks: q.marks || q.maxMarks || 1,
                maxMarks: q.maxMarks || q.marks || 1
            }));

            // eslint-disable-next-line react-hooks/purity
            const now = Date.now();
            setActiveAssessment({
                ...fullAssessment,
                questions: normalizedQuestions,
                startTime: now,
                answers: {},
                currentQuestionIdx: 0
            });
        } catch (err) {
            console.error("Failed to start assessment:", err);
            alert(`Failed to load assessment questions: ${err.message}`);
        }
    }

    const handleSubmitTest = async (submissionData) => {
        try {
            if (activeAssessment?.isSelfGeneratedMock) {
                // Save Mock Exam to local storage only
                const allMockSubmissions = JSON.parse(localStorage.getItem('student_mock_submissions') || '[]');
                const newMockSubmission = {
                    ...submissionData,
                    id: `mock_sub_${Date.now()}`,
                    studentEmail: user.email,
                    createdAt: new Date().toISOString(),
                    status: 'graded'
                };
                localStorage.setItem('student_mock_submissions', JSON.stringify([...allMockSubmissions, newMockSubmission]));
                setActiveAssessment(null);
                await loadData();
                return;
            }

            try {
                await apiService.questions.assessments.delivery.submit(submissionData.assessmentId, submissionData);
            } catch (apiErr) {
                // If already submitted (409 conflict), treat as finished
                if (!apiErr.message?.toLowerCase().includes('already submitted')) {
                    throw apiErr;
                }
            }
            setActiveAssessment(null);
            await loadData();
        } catch (error) {
            console.error("Submission failed:", error);
            alert(`Failed to submit test: ${error.message}`);
            setActiveAssessment(null);
            await loadData();
        }
    }

    const handleGenerateMock = (mockAssessment) => {
        setShowMockModal(false);
        // Save to local storage
        const existingMocks = JSON.parse(localStorage.getItem('student_mock_assessments') || '[]');
        localStorage.setItem('student_mock_assessments', JSON.stringify([...existingMocks, mockAssessment]));
        
        // Instantly start test
        handleStartTest(mockAssessment);
    }

    const totalScore = results.filter(r => !r.pending).reduce((acc, r) => {
        const got = r.mcqScore + (r.manualScore || 0)
        const max = Math.max(1, (r.mcqTotal || 0) + (r.manualTotal || 0))
        return acc + (got / max)
    }, 0)
    const avgScore = results.length > 0 ? Math.round((totalScore / results.length) * 100) : 0

    return (
        <DashboardLayout
            user={user}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onLogout={onLogout}
            navItems={studentNav}
            onUserUpdate={onUserUpdate}
            onStatsClick={() => setShowStatsModal(true)}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    style={{ height: '100%' }}
                >
                    {/* DASHBOARD TAB */}
                    {activeTab === 'dashboard' && (
                        <div className="lumina-content-home">
                            <div className="lumina-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2><div className="lumina-icon-indicator" />Overview</h2>
                                <button className="lumina-btn-primary" onClick={() => setShowMockModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }}>
                                    <BrainCircuit size={16} /> Generate AI Practice Test
                                </button>
                            </div>

                            <div className="lumina-bento-grid">
                                <motion.div className="lumina-card" whileHover={{ y: -5 }}>
                                    <div className="lumina-stat-header">
                                        <div className="lumina-stat-icon"><Target size={24} /></div>
                                        <span className="lumina-stat-trend">TOP 12%</span>
                                    </div>
                                    <span className="lumina-stat-label">Average Score</span>
                                    <h3 className="lumina-stat-value">{avgScore}%</h3>
                                </motion.div>

                                <motion.div className="lumina-card" whileHover={{ y: -5 }}>
                                    <div className="lumina-stat-header">
                                        <div className="lumina-stat-icon" style={{ color: 'var(--lumina-gold)' }}><BookOpen size={24} /></div>
                                    </div>
                                    <span className="lumina-stat-label">Classes Joined</span>
                                    <h3 className="lumina-stat-value">{enrolledClasses.length}</h3>
                                </motion.div>

                                <motion.div className="lumina-card" whileHover={{ y: -5 }}>
                                    <div className="lumina-stat-header">
                                        <div className="lumina-stat-icon" style={{ color: 'var(--lumina-teal)' }}><ClipboardList size={24} /></div>
                                    </div>
                                    <span className="lumina-stat-label">Completed</span>
                                    <h3 className="lumina-stat-value">{results.length}</h3>
                                </motion.div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px' }}>
                                <section>
                                    <div className="lumina-section-title">
                                        <h2><div className="lumina-icon-indicator" />Active Assessments</h2>
                                        <span style={{ fontSize: 12, color: 'var(--lumina-text-muted)', cursor: 'pointer' }} onClick={() => setActiveTab('assessments')}>VIEW ALL</span>
                                    </div>

                                    {pendingMissions.length === 0 ? (
                                        <div className="lumina-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                                            <div style={{ background: 'rgba(255,255,255,0.02)', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                                <Zap size={30} opacity={0.3} />
                                            </div>
                                            <h3>No Active Assessments</h3>
                                            <p style={{ color: 'var(--lumina-text-dim)' }}>You've completed all missions.</p>
                                        </div>
                                    ) : (
                                        <div className="lumina-card" style={{ padding: 0 }}>
                                            <table className="lumina-table" style={{ width: '100%' }}>
                                                <tbody>
                                                    {pendingMissions.slice(0, 3).map(m => (
                                                        <tr key={m.id} style={{ borderBottom: '1px solid var(--lumina-border)' }}>
                                                            <td style={{ padding: '20px 24px' }}>
                                                                <div style={{ fontWeight: 700 }}>{m.title}</div>
                                                                <div style={{ fontSize: 11, color: 'var(--lumina-text-muted)' }}>{m.className}</div>
                                                            </td>
                                                            <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                                <button className="lumina-btn-elite" style={{ width: 'auto', padding: '6px 16px', fontSize: 12 }} onClick={() => setActiveTab('assessments')}>Take Test</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </section>

                                <aside>
                                    <div className="lumina-section-title">
                                        <h2><div className="lumina-icon-indicator" style={{ background: 'var(--lumina-purple)' }} />Activity Insights</h2>
                                    </div>
                                    <div className="lumina-card" style={{ padding: '20px' }}>
                                        {activityInsights.map((insight, index) => (
                                            <div key={insight.id} className="lumina-insight-item" style={{ display: 'flex', gap: 12, marginBottom: index !== activityInsights.length - 1 ? 20 : 0 }}>
                                                <div style={{ color: insight.color }}>{insight.icon}</div>
                                                <p style={{ fontSize: 12, margin: 0 }}>{insight.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </aside>
                            </div>
                        </div>
                    )}

                    {/* CLASSES TAB */}
                    {activeTab === 'classes' && (
                        <div className="lumina-content-secondary">
                            <div className="lumina-section-title">
                                <h2><div className="lumina-icon-indicator" />My Classes</h2>
                            </div>
                            <div className="lumina-card" style={{ marginBottom: 32, display: 'flex', gap: 24, alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <h3>Class Admission</h3>
                                    <p style={{ color: 'var(--lumina-text-dim)' }}>Enter your class code below to join a new classroom.</p>
                                </div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <input ref={joinCodeInputRef} placeholder="Enter Code..." style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--lumina-border)', borderRadius: 12, padding: '12px 16px', color: 'var(--lumina-text-main, #09090b)' }} />
                                    <button type="button" className="lumina-btn-elite" style={{ width: 'auto' }} onClick={handleJoinClass}>Join</button>
                                </div>
                            </div>
                            <div className="lumina-section-title" style={{ marginTop: 8 }}>
                                <h2><div className="lumina-icon-indicator" style={{ background: 'var(--lumina-purple)' }} />Enrolled</h2>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                                {enrolledClasses.map((c) => (
                                    c.is_deleted ? (
                                        <div key={c.id} className="lumina-card" style={{ border: '1px solid var(--lumina-rose, #f43f5e)', background: 'rgba(244, 63, 94, 0.05)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                                <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: 'var(--lumina-rose, #f43f5e)', padding: 12, borderRadius: 12 }}>
                                                    <AlertCircle size={24} />
                                                </div>
                                                <button
                                                    onClick={(e) => handleLeaveClass(e, c.id)}
                                                    style={{ background: 'var(--lumina-rose, #f43f5e)', border: 'none', color: 'white', cursor: 'pointer', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}
                                                    title="Dismiss Notification"
                                                >
                                                    <X size={14} /> DISMISS
                                                </button>
                                            </div>
                                            <h3 style={{ margin: '0 0 4px', color: 'var(--lumina-rose, #f43f5e)' }}>Class Removed</h3>
                                            <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>The class <strong>{c.name}</strong> was removed by the teacher and is no longer accessible.</p>
                                        </div>
                                    ) : (
                                        <div key={c.id} className="lumina-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                                <div style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--lumina-teal)', padding: 12, borderRadius: 12 }}>
                                                    <BookOpen size={24} />
                                                </div>
                                                <button
                                                    onClick={(e) => handleLeaveClass(e, c.id)}
                                                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}
                                                    title="Leave Class"
                                                >
                                                    <LogOut size={14} /> LEAVE
                                                </button>
                                            </div>
                                            <h3 style={{ margin: '0 0 4px' }}>{c.name}</h3>
                                            <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Code: {c.code}</p>
                                        </div>
                                    )
                                ))}
                                {enrolledClasses.length === 0 && (
                                    <div className="lumina-card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48 }}>
                                        <p style={{ color: 'var(--lumina-text-dim)', margin: 0 }}>No classes yet. Join one with a code from your teacher.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ASSESSMENTS TAB */}
                    {activeTab === 'assessments' && (
                        <div className="lumina-content-secondary">
                            <div className="lumina-section-title">
                                <h2><div className="lumina-icon-indicator" />Assessment Hub</h2>
                            </div>
                            <div className="lumina-card" style={{ padding: 0 }}>
                                <table className="lumina-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--lumina-border)', background: 'rgba(0,0,0,0.2)' }}>
                                            <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>MISSION TITLE</th>
                                            <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>CLASS</th>
                                            <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>STATUS</th>
                                            <th style={{ padding: '16px 24px', textAlign: 'right' }}>ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allStudentAssessments.length === 0 ? (
                                            <tr><td colSpan="4" style={{ padding: 60, textAlign: 'center', opacity: 0.5 }}>No assessments found. Join a class to see available missions.</td></tr>
                                        ) : (
                                            allStudentAssessments.map(a => {
                                                const isDone = results.some(r => r.assessmentId === a.id)
                                                const isExpired = a.deadline && new Date() > new Date(a.deadline)
                                                return (
                                                    <tr key={a.id} style={{ borderBottom: '1px solid var(--lumina-border)', opacity: isExpired && !isDone ? 0.6 : 1 }}>
                                                        <td style={{ padding: '20px 24px' }}>
                                                            <div style={{ fontWeight: 700 }}>{a.title}</div>
                                                            <div style={{ fontSize: 11, opacity: 0.6 }}>{a.questions?.length || 0} Items • {a.duration || 30} mins {a.deadline ? `• Due: ${new Date(a.deadline).toLocaleString()}` : ''}</div>
                                                        </td>
                                                        <td style={{ padding: '20px 24px' }}>
                                                            <span style={{ fontSize: 12, color: 'var(--lumina-teal)', fontWeight: 700 }}>{a.className?.toUpperCase() || 'GENERAL'}</span>
                                                        </td>
                                                        <td style={{ padding: '20px 24px' }}>
                                                            {isDone ? (
                                                                <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>COMPLETED</span>
                                                            ) : isExpired ? (
                                                                <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>MISSED</span>
                                                            ) : (
                                                                <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>AVAILABLE</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                            <button
                                                                onClick={() => handleStartTest(a)}
                                                                className={isDone || isExpired ? 'lumina-btn-secondary' : 'lumina-btn-elite'}
                                                                style={{ width: 'auto', padding: '8px 16px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                                                                disabled={isDone || isExpired}
                                                            >
                                                                {isDone ? 'Reviewed' : isExpired ? 'Expired' : <><Play size={12} fill="white" /> Begin</>}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* RESULTS TAB */}
                    {activeTab === 'results' && (
                        <div className="lumina-content-secondary">
                            <div className="lumina-section-title">
                                <h2><div className="lumina-icon-indicator" />My Results</h2>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                {/* Official Results */}
                                <div>
                                    <h3 style={{ marginBottom: '16px', color: 'var(--lumina-text-main)' }}>Official Assessments</h3>
                                    {results.length === 0 ? (
                                        <div className="lumina-card" style={{ padding: 40, textAlign: 'center' }}>
                                            <AlertCircle size={30} opacity={0.2} style={{ margin: '0 auto 12px', display: 'block' }} />
                                            <h4 style={{ margin: '0 0 8px' }}>No Official Results</h4>
                                        </div>
                                    ) : (
                                        <div className="lumina-card" style={{ padding: 0 }}>
                                            <table className="lumina-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--lumina-border)', background: 'rgba(0,0,0,0.2)' }}>
                                                        <th style={{ padding: '12px 16px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>ASSESSMENT</th>
                                                        <th style={{ padding: '12px 16px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>SCORE</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {results.map((r, i) => (
                                                        <tr key={i} style={{ borderBottom: '1px solid var(--lumina-border)' }}>
                                                            <td style={{ padding: '16px', fontWeight: 700 }}>{r.assessmentTitle || 'Assessment'}</td>
                                                            <td style={{ padding: '16px' }}>
                                                                <span style={{ fontWeight: 800, color: (r.percentage || 0) >= 70 ? 'var(--lumina-teal)' : 'var(--lumina-rose)' }}>{r.percentage || 0}%</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* AI Practice Results */}
                                <div>
                                    <h3 style={{ marginBottom: '16px', color: 'var(--lumina-text-main)' }}>AI Practice Results</h3>
                                    {mockResults.length === 0 ? (
                                        <div className="lumina-card" style={{ padding: 40, textAlign: 'center' }}>
                                            <BrainCircuit size={30} opacity={0.2} style={{ margin: '0 auto 12px', display: 'block' }} />
                                            <h4 style={{ margin: '0 0 8px' }}>No Practice Results</h4>
                                        </div>
                                    ) : (
                                        <div className="lumina-card" style={{ padding: 0 }}>
                                            <table className="lumina-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--lumina-border)', background: 'rgba(0,0,0,0.2)' }}>
                                                        <th style={{ padding: '12px 16px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>PRACTICE TOPIC</th>
                                                        <th style={{ padding: '12px 16px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>SCORE</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {mockResults.map((r, i) => (
                                                        <tr key={i} style={{ borderBottom: '1px solid var(--lumina-border)' }}>
                                                            <td style={{ padding: '16px', fontWeight: 700 }}>{r.assessmentTitle}</td>
                                                            <td style={{ padding: '16px' }}>
                                                                <span style={{ fontWeight: 800, color: (r.percentage || 0) >= 70 ? 'var(--lumina-teal)' : 'var(--lumina-rose)' }}>{r.percentage || 0}%</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* PERFORMANCE ANALYTICS MODAL */}
            <AnimatePresence>
                {showStatsModal && (
                    <motion.div className="lumina-modal-overlay" data-lenis-prevent initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="lumina-profile-modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} style={{ maxWidth: 800 }}>
                            <div className="lumina-modal-header" style={{ marginBottom: 32 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <TrendingUp size={24} className="lp-gradient-text" />
                                    <h2 style={{ fontSize: 24, fontWeight: 800 }}>Performance Analytics</h2>
                                </div>
                                <button onClick={() => setShowStatsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--lumina-text-main)', cursor: 'pointer' }}><X size={24} /></button>
                            </div>

                            <div className="lumina-modal-content">
                                <div className="analytics-card-main">
                                    <div className="analytics-circle-stats">
                                        <div className="analytics-circle-outer">
                                            <div className="analytics-percentage-box">
                                                <div className="label">Current Average</div>
                                                <div className="value">{avgScore}%</div>
                                                <div className="trend">
                                                    <TrendingUp size={14} />
                                                    <span>
                                                        {(() => {
                                                            const hist = results.filter(r => !r.pending).map(r => {
                                                                const got = r.mcqScore + (r.manualScore || 0);
                                                                const max = Math.max(1, (r.mcqTotal || 0) + (r.manualTotal || 0));
                                                                return Math.round((got / max) * 100);
                                                            });
                                                            if (hist.length >= 2) {
                                                                const diff = hist[hist.length - 1] - hist[hist.length - 2];
                                                                return `${diff > 0 ? '+' : ''}${diff}% from last test`;
                                                            }
                                                            return 'First cycle';
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="analytics-chart-area">
                                        <div className="analytics-chart-lines">
                                            {[1, 2, 3, 4].map(i => <div key={i} className="chart-line" />)}
                                            <div style={{ height: 0, position: 'relative' }}>
                                                {(() => {
                                                    const hist = results.filter(r => !r.pending).map(r => {
                                                        const got = r.mcqScore + (r.manualScore || 0);
                                                        const max = Math.max(1, (r.mcqTotal || 0) + (r.manualTotal || 0));
                                                        return Math.round((got / max) * 100);
                                                    });
                                                    const data = hist.length >= 2 ? hist : (hist.length === 1 ? [0, hist[0]] : [0, 0]);
                                                    
                                                    const pathD = data.map((val, i) => {
                                                        const x = (i / (data.length - 1)) * 320;
                                                        const y = 100 - Math.max(10, val * 0.9); // scaling y to fit within 100px SVG height nicely
                                                        return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
                                                    }).join(' ');

                                                    const lastX = 320;
                                                    const lastY = 100 - Math.max(10, data[data.length - 1] * 0.9);

                                                    return (
                                                        <svg width="100%" height="100" viewBox="0 0 320 100" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, overflow: 'visible' }}>
                                                            <motion.path 
                                                                d={pathD} 
                                                                fill="none" 
                                                                stroke="var(--lumina-teal)" 
                                                                strokeWidth="3"
                                                                initial={{ pathLength: 0 }}
                                                                animate={{ pathLength: 1 }}
                                                                transition={{ duration: 1.5 }}
                                                            />
                                                            <circle cx={lastX} cy={lastY} r="4" fill="var(--lumina-teal)" />
                                                            <text x={lastX - 10} y={lastY - 10} fill="var(--lumina-text-main)" fontSize="12" fontWeight="bold">{data[data.length - 1]}%</text>
                                                        </svg>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <div className="analytics-chart-labels">
                                            {(() => {
                                                const hist = results.filter(r => !r.pending);
                                                const count = hist.length >= 2 ? hist.length : 2;
                                                return Array.from({length: count}).map((_, i) => <span key={i} className="chart-label">T{i+1}</span>)
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                <div className="analytics-footer">
                                    <button className="lp-btn-ghost" style={{ padding: '10px 24px', fontSize: 14 }} onClick={handleDownloadReport}>
                                        Download Report
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ASSESSMENT PLAYER */}
            <AnimatePresence>
                {activeAssessment && (
                    <div className="active-test-overlay">
                        <AssessmentPlayer
                            assessment={activeAssessment}
                            onExit={() => setActiveAssessment(null)}
                            onSubmit={handleSubmitTest}
                        />
                    </div>
                )}
            </AnimatePresence>

            {/* MOCK EXAM MODAL */}
            {showMockModal && (
                <MockExamModal
                    onClose={() => setShowMockModal(false)}
                    onGenerate={handleGenerateMock}
                />
            )}
        </DashboardLayout>
    )
}
