import React, { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Users,
    BookOpen,
    ClipboardList,
    ShieldCheck,
    UserMinus,
    Search,
    ArrowRight,
    Activity,
    AlertCircle,
    CheckCircle2,
    X,
    UserCheck,
    Trash2
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import apiService from '../../services/apiService';
import '../../styles/DashboardStyles.css';

export default function AdminDashboard({ user, onLogout, onUserUpdate }) {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [allUsers, setAllUsers] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [allAssessments, setAllAssessments] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedAssessment, setSelectedAssessment] = useState(null);
    const [viewingStudent, setViewingStudent] = useState(null);
    const [selectedSubmission, setSelectedSubmission] = useState(null);

    const adminNav = [
        { key: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
        { key: 'teachers', icon: UserCheck, label: 'Teachers' },
        { key: 'classes', icon: BookOpen, label: 'Classes' },
        { key: 'assessments', icon: ClipboardList, label: 'Assessments' },
        { key: 'manage', icon: ShieldCheck, label: 'Management' },
    ];

    const [adminStudentStats, setAdminStudentStats] = useState([]);

    // Moved useEffect below loadData
    const loadData = async () => {
        try {
            let users = [];
            let classes = [];
            let assessments = [];
            let studentStats = [];

            try {
                const res = await apiService.admin.users.list();
                if (res) users = res;
            } catch (e) {
                console.error("Failed to load users", e);
            }

            try {
                const res = await apiService.courses.list();
                if (res) classes = res;
            } catch (e) {
                console.error("Failed to load classes", e);
            }

            try {
                const res = await apiService.questions.assessments.list();
                if (res) assessments = res;
            } catch (e) {
                console.error("Failed to load assessments", e);
            }

            // No separate students endpoint — derive from users list
            studentStats = users.filter(u => u.role?.toLowerCase() === 'student');

            setAllUsers(users);
            setAllClasses(classes);
            setAllAssessments(assessments);
            setAdminStudentStats(studentStats);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadData();
    }, []);

    const teachers = allUsers.filter(u => u.role?.toLowerCase() === 'teacher');
    const students = allUsers.filter(u => u.role?.toLowerCase() === 'student');

    const getClassEnrollment = (classId) => {
        const classObj = allClasses.find(c => String(c.id) === String(classId));
        return classObj ? classObj.enrolled_count : 0;
    };

    const getStudentsInClass = (classId) => {
        const classObj = allClasses.find(c => String(c.id) === String(classId));
        if (!classObj) return [];
        const enrolledEmails = adminStudentStats
            .filter(s => s.courses && s.courses.includes(classObj.title))
            .map(s => s.email);
        return students.filter(s => enrolledEmails.includes(s.email));
    };

    const getStudentPerformanceInClass = (studentEmail, classId) => {
        const studentStat = adminStudentStats.find(s => s.email === studentEmail);
        if (!studentStat || !studentStat.submissions) return { completed: 0, avgScore: 0 };

        // Find class name to filter submissions
        const classObj = allClasses.find(c => String(c.id) === String(classId));
        if (!classObj) return { completed: 0, avgScore: 0 };

        // We can't strictly filter by classId because submission doesn't have it, but we can match assessments
        // Assuming submissions are linked to assessments in this class
        const classAssessmentIds = allAssessments.filter(a => String(a.course_id) === String(classId) || String(a.classId) === String(classId)).map(a => String(a.id));

        const classResults = studentStat.submissions.filter(sub => classAssessmentIds.includes(String(sub.assessment_id)));

        if (classResults.length === 0) return { completed: 0, avgScore: 0 };

        const total = classResults.reduce((acc, r) => {
            const got = r.score || 0;
            const max = r.total_possible || 1;
            return acc + (got / max);
        }, 0);

        return {
            completed: classResults.length,
            avgScore: Math.round((total / classResults.length) * 100)
        };
    };

    const handleDeleteAssessment = async (id) => {
        if (window.confirm('Are you sure you want to delete this assessment? This action cannot be undone.')) {
            try {
                await apiService.questions.assessments.delete(id);
                loadData();
            } catch (e) {
                console.error("Failed to delete assessment", e);
                alert("Failed to delete assessment.");
            }
        }
    };

    const handleSuspendTeacher = async (id, currentIsActive) => {
        if (window.confirm(`Are you sure you want to ${currentIsActive ? 'suspend' : 'activate'} this teacher?`)) {
            try {
                await apiService.admin.users.updateStatus(id, currentIsActive ? 'suspended' : 'active');
                loadData();
            } catch (e) {
                console.error("Failed to suspend/activate teacher", e);
                alert("Action failed.");
            }
        }
    };

    return (
        <DashboardLayout
            user={user}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onLogout={onLogout}
            navItems={adminNav}
            onUserUpdate={onUserUpdate}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                >
                    {activeTab === 'dashboard' && (
                        <div className="lumina-content-home">
                            <div className="lumina-section-title">
                                <h2><div className="lumina-icon-indicator" />Platform Statistics</h2>
                            </div>
                            <div className="lumina-bento-grid">
                                <div className="lumina-card">
                                    <div className="lumina-stat-header">
                                        <div className="lumina-stat-icon"><UserCheck size={24} /></div>
                                    </div>
                                    <span className="lumina-stat-label">Total Teachers</span>
                                    <h3 className="lumina-stat-value">{teachers.length}</h3>
                                </div>
                                <div className="lumina-card">
                                    <div className="lumina-stat-header">
                                        <div className="lumina-stat-icon" style={{ color: 'var(--lumina-purple)' }}><Users size={24} /></div>
                                    </div>
                                    <span className="lumina-stat-label">Total Students</span>
                                    <h3 className="lumina-stat-value">{students.length}</h3>
                                </div>
                                <div className="lumina-card">
                                    <div className="lumina-stat-header">
                                        <div className="lumina-stat-icon" style={{ color: 'var(--lumina-teal)' }}><ClipboardList size={24} /></div>
                                    </div>
                                    <span className="lumina-stat-label">Total Assessments</span>
                                    <h3 className="lumina-stat-value">{allAssessments.length}</h3>
                                </div>
                            </div>

                            <div className="lumina-section-title">
                                <h2><div className="lumina-icon-indicator" />Recent Activity Feed</h2>
                            </div>
                            <div className="lumina-card">
                                {allAssessments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {allAssessments.slice(-5).reverse().map(a => (
                                            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderRadius: 12, border: '1px solid var(--lumina-border)' }}>
                                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                    <div style={{ padding: 8, background: 'rgba(6,182,212,0.1)', color: 'var(--lumina-teal)', borderRadius: 8 }}>
                                                        <Activity size={18} />
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>New Assessment Created: {a.title}</p>
                                                        <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>Teacher ID: {a.teacherId}</p>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 11, opacity: 0.4 }}>JUST NOW</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ textAlign: 'center', opacity: 0.5, padding: 20 }}>No clinical data available yet.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'teachers' && (
                        <div className="lumina-content-secondary">
                            <div className="lumina-section-title">
                                <h2><div className="lumina-icon-indicator" />Teacher Directory</h2>
                            </div>
                            <div className="lumina-card" style={{ padding: 0 }}>
                                <table className="lumina-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--lumina-border)', background: 'rgba(0,0,0,0.05)' }}>
                                            <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>TEACHER NAME</th>
                                            <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>EMAIL</th>
                                            <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>ASSESSMENTS</th>
                                            <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>STATUS</th>
                                            <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teachers.length === 0 ? (
                                            <tr><td colSpan="5" style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>No teachers registered yet.</td></tr>
                                        ) : teachers.map(t => (
                                            <tr key={t.id || t.email} style={{ borderBottom: '1px solid var(--lumina-border)' }}>
                                                <td style={{ padding: '20px 24px', fontWeight: 700 }}>{t.name}</td>
                                                <td style={{ padding: '20px 24px', fontSize: 12, opacity: 0.7 }}>{t.email}</td>
                                                <td style={{ padding: '20px 24px' }}>
                                                    {allAssessments.filter(a => a.teacher_id === t.id || a.teacherId === t.id).length}
                                                </td>
                                                <td style={{ padding: '20px 24px' }}>
                                                    <span style={{
                                                        background: t.is_active === false || t.status === 'suspended' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                        color: t.is_active === false || t.status === 'suspended' ? '#f43f5e' : '#10b981',
                                                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700
                                                    }}>
                                                        {t.is_active === false || t.status === 'suspended' ? 'SUSPENDED' : 'ACTIVE'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '20px 24px' }}>
                                                    <button
                                                        onClick={() => handleSuspendTeacher(t.id, !(t.is_active === false || t.status === 'suspended'))}
                                                        style={{
                                                            background: t.is_active === false || t.status === 'suspended' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                                                            color: t.is_active === false || t.status === 'suspended' ? '#10b981' : '#f43f5e',
                                                            border: 'none', borderRadius: 8, padding: '6px 14px',
                                                            fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                                        }}
                                                    >
                                                        {t.is_active === false || t.status === 'suspended' ? 'Activate' : 'Suspend'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'classes' && (
                        <div className="lumina-content-secondary">
                            <AnimatePresence mode="wait">
                                {!selectedClass ? (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="class-list">
                                        <div className="lumina-section-title">
                                            <h2><div className="lumina-icon-indicator" />Class Ecosystem</h2>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                                            {allClasses.map(c => (
                                                <div key={c.id} className="lumina-card">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                                        <div style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--lumina-purple)', padding: 10, borderRadius: 10 }}>
                                                            <BookOpen size={20} />
                                                        </div>
                                                        <span style={{ fontSize: 10, opacity: 0.5, fontWeight: 700 }}>CODE: {c.code}</span>
                                                    </div>
                                                    <h3 style={{ margin: '0 0 4px' }}>{c.name}</h3>
                                                    <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Teacher ID: {c.teacherId}</p>
                                                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ fontSize: 11, fontWeight: 800 }}>{getClassEnrollment(c.id)} STUDENTS</div>
                                                        <div
                                                            style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--lumina-teal)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                                            onClick={() => setSelectedClass(c)}
                                                        >
                                                            VIEW <ArrowRight size={14} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="class-detail">
                                        <div className="lumina-section-title">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <button onClick={() => {
                                                    if (viewingStudent) setViewingStudent(null);
                                                    else setSelectedClass(null);
                                                }} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--lumina-text-main)', cursor: 'pointer', padding: 8, borderRadius: '50%', display: 'flex' }}>
                                                    <ArrowRight size={20} style={{ transform: 'rotate(180deg)' }} />
                                                </button>
                                                <h2 style={{ textTransform: 'uppercase' }}>{selectedClass.name} {viewingStudent && <span style={{ opacity: 0.5 }}>/ {viewingStudent.name}</span>}</h2>
                                            </div>
                                        </div>
                                        <div className="lumina-card" style={{ padding: 0 }}>
                                            <table className="lumina-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--lumina-border)', background: 'rgba(0,0,0,0.05)' }}>
                                                        <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>{viewingStudent ? 'ASSESSMENT TITLE' : 'STUDENT'}</th>
                                                        <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>{viewingStudent ? 'COMPLETION DATE' : 'EMAIL'}</th>
                                                        <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>{viewingStudent ? 'FINAL SCORE' : 'TESTS COMPLETED'}</th>
                                                        <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)', textAlign: 'right' }}>ACTIONS</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {!viewingStudent ? (
                                                        getStudentsInClass(selectedClass.id).length === 0 ? (
                                                            <tr><td colSpan="4" style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>No students enrolled in this class yet.</td></tr>
                                                        ) : (
                                                            getStudentsInClass(selectedClass.id).map(s => {
                                                                const perf = getStudentPerformanceInClass(s.email, selectedClass.id);
                                                                return (
                                                                    <tr key={s.email} style={{ borderBottom: '1px solid var(--lumina-border)' }}>
                                                                        <td style={{ padding: '20px 24px', fontWeight: 700 }}>{s.name}</td>
                                                                        <td style={{ padding: '20px 24px', fontSize: 12, opacity: 0.7 }}>{s.email}</td>
                                                                        <td style={{ padding: '20px 24px' }}>{perf.completed} Tests</td>
                                                                        <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                                            <button
                                                                                onClick={() => setViewingStudent(s)}
                                                                                style={{ background: 'none', border: 'none', color: 'var(--lumina-teal)', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}
                                                                            >
                                                                                View Results
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )
                                                    ) : (
                                                        /* Student's taken tests list */
                                                        JSON.parse(localStorage.getItem(`results_${viewingStudent.email}`) || '[]')
                                                            .filter(r => r.classId === selectedClass.id)
                                                            .map((res, idx) => {
                                                                const formattedDate = res.timestamp && !isNaN(new Date(res.timestamp).getTime())
                                                                    ? new Date(res.timestamp).toLocaleDateString()
                                                                    : 'Recently';

                                                                return (
                                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--lumina-border)' }}>
                                                                        <td style={{ padding: '20px 24px', fontWeight: 700 }}>{res.assessmentTitle || 'Unit Test'}</td>
                                                                        <td style={{ padding: '20px 24px', fontSize: 11, opacity: 0.5 }}>{formattedDate}</td>
                                                                        <td style={{ padding: '20px 24px', fontWeight: 800, color: 'var(--lumina-teal)' }}>
                                                                            {Math.round(((res.mcqScore + (res.manualScore || 0)) / ((res.mcqTotal || 0) + (res.manualTotal || 0))) * 100)}%
                                                                        </td>
                                                                        <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const originalAssessment = allAssessments.find(a => a.id === res.assessmentId);
                                                                                    setSelectedSubmission({
                                                                                        ...res,
                                                                                        student: viewingStudent,
                                                                                        questions: originalAssessment?.questions || []
                                                                                    });
                                                                                }}
                                                                                style={{ background: 'none', border: 'none', color: 'var(--lumina-purple)', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}
                                                                            >
                                                                                Review Submission
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {activeTab === 'assessments' && (
                        <div className="lumina-content-secondary">
                            <AnimatePresence mode="wait">
                                {!selectedAssessment ? (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="assessment-list">
                                        <div className="lumina-section-title">
                                            <h2><div className="lumina-icon-indicator" />Global Repository</h2>
                                        </div>
                                        <div className="lumina-card" style={{ padding: 0 }}>
                                            <table className="lumina-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--lumina-border)', background: 'rgba(0,0,0,0.05)' }}>
                                                        <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>TITLE</th>
                                                        <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>CLASS</th>
                                                        <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>ITEMS</th>
                                                        <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)', textAlign: 'right' }}>ACTIONS</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {allAssessments.map(a => {
                                                        const className = allClasses.find(c => c.id === a.classId)?.name || 'Unknown';
                                                        return (
                                                            <tr key={a.id} style={{ borderBottom: '1px solid var(--lumina-border)' }}>
                                                                <td style={{ padding: '20px 24px', fontWeight: 700 }}>{a.title}</td>
                                                                <td style={{ padding: '20px 24px' }}>
                                                                    <span style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--lumina-teal)', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{className.toUpperCase()}</span>
                                                                </td>
                                                                <td style={{ padding: '20px 24px' }}>{a.questions?.length || 0} Questions</td>
                                                                <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                                    <button
                                                                        onClick={() => setSelectedAssessment(a)}
                                                                        style={{ background: 'none', border: 'none', color: 'var(--lumina-purple)', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}
                                                                    >
                                                                        View Questions
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="assessment-detail">
                                        <div className="lumina-section-title">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <button onClick={() => setSelectedAssessment(null)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--lumina-text-main)', cursor: 'pointer', padding: 8, borderRadius: '50%', display: 'flex' }}>
                                                    <X size={20} />
                                                </button>
                                                <h2 style={{ textTransform: 'uppercase' }}>{selectedAssessment.title} Questions</h2>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                            {selectedAssessment.questions?.map((q, idx) => (
                                                <div key={idx} className="lumina-card">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.5 }}>QUESTION {idx + 1}</span>
                                                        <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(0,0,0,0.03)', padding: '2px 8px', borderRadius: 4 }}>{q.type?.toUpperCase()}</span>
                                                    </div>
                                                    <h4 style={{ margin: '0 0 16px', fontSize: 16 }}>{q.text}</h4>
                                                    {['mcq', 'msq', 'true_false'].includes(q.type) && q.options && (
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                            {q.options.map((opt, i) => {
                                                                const isCorrect = Array.isArray(q.correct) ? q.correct.includes(opt) : (i === q.correctAnswer || opt === q.correct);
                                                                return (
                                                                    <div key={i} style={{ padding: '10px 16px', background: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.02)', border: isCorrect ? '1px solid #10b981' : '1px solid var(--lumina-border)', borderRadius: 8, fontSize: 13, color: isCorrect ? '#10b981' : 'inherit' }}>
                                                                        {opt}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    {!['mcq', 'msq', 'true_false'].includes(q.type) && (
                                                        <div style={{ padding: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 8, borderLeft: '3px solid var(--lumina-purple)', fontSize: 13 }}>
                                                            Subjective Response - Manual/AI Grading
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {activeTab === 'manage' && (
                        <div className="lumina-content-secondary">
                            <div className="lumina-section-title">
                                <h2><div className="lumina-icon-indicator" />System Control Panel</h2>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                                <section>
                                    <h3 style={{ marginBottom: 16 }}>Manage Teachers</h3>
                                    <div className="lumina-card" style={{ padding: 0 }}>
                                        {teachers.map(t => (
                                            <div key={t.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--lumina-border)' }}>
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: 700 }}>{t.name}</p>
                                                    <p style={{ margin: 0, fontSize: 11, opacity: 0.5 }}>{t.email}</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: 12 }}>
                                                    <button
                                                        onClick={() => handleSuspendTeacher(t.id, t.status !== 'suspended')}
                                                        style={{ background: 'none', border: 'none', color: t.status === 'suspended' ? '#10b981' : '#f43f5e', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                                                    >
                                                        {t.status === 'suspended' ? 'ACTIVATE' : 'SUSPEND'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <h3 style={{ marginBottom: 16 }}>Manage Assessments</h3>
                                    <div className="lumina-card" style={{ padding: 0 }}>
                                        {allAssessments.slice(0, 10).map(a => (
                                            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--lumina-border)' }}>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ margin: 0, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</p>
                                                    <p style={{ margin: 0, fontSize: 11, opacity: 0.5 }}>{a.questions?.length || 0} Qs</p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteAssessment(a.id)}
                                                    style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: 8 }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {/* SUBMISSION REVIEW MODAL */}
                    <AnimatePresence>
                        {selectedSubmission && (
                            <motion.div className="lumina-modal-overlay" data-lenis-prevent initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ zIndex: 1000 }}>
                                <motion.div className="lumina-profile-modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} style={{ maxWidth: 800, width: '90%' }}>
                                    <div className="lumina-modal-header" style={{ marginBottom: 32 }}>
                                        <div>
                                            <h2 style={{ fontSize: 20, margin: 0, letterSpacing: 1 }}>STUDENT SUBMISSION REVIEW</h2>
                                            <p style={{ margin: '4px 0 0', opacity: 0.5, fontSize: 12 }}>{selectedSubmission.student.name} • {selectedSubmission.assessmentTitle}</p>
                                        </div>
                                        <button onClick={() => setSelectedSubmission(null)} style={{ background: 'none', border: 'none', color: 'var(--lumina-text-main)', cursor: 'pointer' }}><X size={24} /></button>
                                    </div>

                                    <div className="lumina-modal-content" style={{ maxHeight: '70vh', paddingRight: 10 }}>
                                        {/* Questions and Answers */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                            {(selectedSubmission.questions || []).map((q, idx) => {
                                                const studentAns = selectedSubmission.responses?.[q.id];
                                                const isSubjective = !['mcq', 'msq', 'true_false'].includes(q.type);

                                                return (
                                                    <div key={idx} className="lumina-card">
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                                            <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.5 }}>QUESTION {idx + 1}</span>
                                                            <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(0,0,0,0.03)', color: 'var(--lumina-text-muted, #71717a)', padding: '2px 8px', borderRadius: 4 }}>{q.type?.toUpperCase()}</span>
                                                        </div>
                                                        <h4 style={{ margin: '0 0 20px', fontSize: 15 }}>{q.text}</h4>

                                                        <div style={{ padding: 20, background: '#f8fafc', borderRadius: 16, border: '1px solid var(--lumina-border)' }}>
                                                            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--lumina-teal)', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>Student Answer</span>

                                                            {isSubjective ? (
                                                                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, opacity: 0.9 }}>{studentAns || 'No response provided.'}</p>
                                                            ) : (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                                                    {(() => {
                                                                        const correctArr = Array.isArray(q.correct) ? q.correct : [q.correct].filter(Boolean);
                                                                        const studentArr = Array.isArray(studentAns) ? studentAns : [studentAns].filter(Boolean);
                                                                        const isCorrect = correctArr.length === studentArr.length && correctArr.every(v => studentArr.includes(v));

                                                                        return (
                                                                            <>
                                                                                <div style={{ padding: '8px 16px', background: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', border: `1px solid ${isCorrect ? '#10b981' : '#f43f5e'}`, borderRadius: 8, fontSize: 13, color: isCorrect ? '#10b981' : '#f43f5e' }}>
                                                                                    {studentArr.length ? studentArr.join(', ') : 'None'}
                                                                                </div>
                                                                                {!isCorrect && (
                                                                                    <span style={{ fontSize: 12, opacity: 0.5 }}>Correct: <b style={{ color: '#10b981' }}>{correctArr.join(', ')}</b></span>
                                                                                )}
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="lumina-modal-footer">
                                        <button onClick={() => setSelectedSubmission(null)} className="lumina-btn-secondary">Close Review</button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </AnimatePresence>
        </DashboardLayout>
    );
}
