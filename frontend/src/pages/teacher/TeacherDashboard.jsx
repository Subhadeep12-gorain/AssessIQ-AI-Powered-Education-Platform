import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './TeacherDashboard.css';
import '../../styles/DashboardStyles.css';
import CreateClassModal from '../../components/modals/CreateClassModal';
import CreateAssessmentModal from '../../components/modals/CreateAssessmentModal';
import DashboardLayout from '../../components/DashboardLayout';
import ReviewCenterModal from '../../components/teacher/ReviewCenterModal';
import apiService from '../../services/apiService';
import {
    Check,
    Link,
    Download,
    FileText,
    ChevronRight,
    ChevronLeft,
    TrendingUp,
    Award,
    LayoutDashboard,
    BookOpen,
    ClipboardList,
    Database,
    ShieldCheck,
    Plus,
    Trash2,
    BrainCircuit,
    CheckCircle2,
    X,
    BarChart3,
    Users,
    Copy,
    Clock,
    ArrowRight
} from 'lucide-react';


export default function TeacherDashboard({ user, onLogout, onUserUpdate }) {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [classes, setClasses] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [showCreateClassModal, setShowCreateClassModal] = useState(false);
    const [showCreateAssessmentModal, setShowCreateAssessmentModal] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [copiedCode, setCopiedCode] = useState(null);
    const [linkCode, setLinkCode] = useState('');
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [selectedAssessmentFilter, setSelectedAssessmentFilter] = useState(null);


    const teacherNav = [
        { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { key: 'classes', icon: BookOpen, label: 'My Classes' },
        { key: 'assessments', icon: ClipboardList, label: 'Assessments' },
        { key: 'results', icon: ShieldCheck, label: 'Submissions' },
    ];

    // Moved useEffect below loadData to avoid temporal dead zone
    const loadData = async () => {
        try {
            // Fetch REAL courses from backend
            let apiCourses = [];
            try {
                const res = await apiService.courses.list();
                if (res) {
                    // Backend returns Array of classes directly in res
                    apiCourses = res.map(c => ({
                        id: c.id,
                        name: c.name,
                        code: c.code,
                        teacherId: c.teacher_id,
                        assessmentCount: c.assessment_count
                    }));
                }
            } catch (err) {
                console.error("Failed to load courses from API:", err);
            }

            // Fetch REAL assessments from backend
            let apiAssessments = [];
            try {
                const res = await apiService.questions.assessments.list();
                if (res) {
                    // backend returns snake_case, map to camelCase so our class filters work
                    apiAssessments = res.map(a => ({
                        ...a,
                        classId: a.class_id ?? a.classId,
                        teacherId: a.teacher_id ?? a.teacherId,
                        createdAt: a.created_at ?? a.createdAt,
                    }));
                }
            } catch (err) {
                console.error("Failed to load assessments from API:", err);
            }

            // Fetch REAL submissions from backend
            let apiSubmissions = [];
            try {
                const res = await apiService.questions.submissions.list();
                if (res) {
                    apiSubmissions = res;
                }
            } catch (err) {
                console.error("Failed to load submissions from API:", err);
            }

            setClasses(apiCourses);
            setAssessments(apiAssessments);
            setSubmissions(apiSubmissions);
            setSelectedClass((current) => {
                if (!current) return null;
                return apiCourses.find(c => String(c.id) === String(current.id)) || null;
            });
        } catch (error) {
            console.error("Error loading data:", error);
        }
    };

    useEffect(() => {
        if (user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            loadData();
            window.addEventListener('storage', loadData);
            return () => window.removeEventListener('storage', loadData);
        }

    }, [user]);

    const handleCopyCode = (e, code) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const handleLinkClass = async () => {
        const code = linkCode.trim().toUpperCase();
        if (!code) { alert('Please enter a class code to link.'); return; }

        try {
            // Note: If backend supports a 'join' endpoint for teachers, call it here. 
            // For now, we fetch all courses and find the match to simulate linking
            const res = await apiService.courses.list();
            const match = res?.data?.find(c => String(c.code).toUpperCase() === code);
            if (!match) { alert('No class found with that code. Ask the student to share a valid code.'); return; }

            // Note: Since backend handles teacher assignment, this might need a specific endpoint
            // Currently assuming courses fetched are already linked.
            alert(`Successfully linked to class: ${match.title || match.name}`);
            setLinkCode('');
            await loadData();
        } catch (err) {
            console.error(err);
            alert("Failed to link class.");
        }
    };

    const handleExportCSV = () => {
        if (submissions.length === 0) return;

        const headers = ["Student Email", "Assessment", "Score (%)", "Status", "Date"];
        const rows = submissions.map(s => {
            const aTitle = assessments.find(a => a.id === s.assessmentId)?.title || "N/A";
            return [s.studentEmail, aTitle, s.percentage || 0, s.status || "Pending", s.createdAt || "N/A"];
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(r => r.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `AssessIQ_Results_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGradeSubmission = async (id, finalManualScore, feedback) => {
        try {
            await apiService.questions.submissions.override(id, { override_score: finalManualScore, reason: feedback });
            await loadData();
            setSelectedSubmission(null);
        } catch (apiErr) {
            console.error("Grade submission failed:", apiErr);
            alert(`Failed to grade submission: ${apiErr.message}`);
        }
    };

    const handleDeleteClass = async (e, id) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this class? Students will receive an announcement that the class was removed.")) {
            try {
                await apiService.courses.delete(id);
                loadData();
            } catch (err) {
                console.error("Failed to delete class", err);
                alert("Failed to delete class: " + err.message);
            }
        }
    };

    const handleDeleteAssessment = async (id) => {
        if (!window.confirm("Are you sure you want to delete this assessment? This action cannot be undone and will remove all student submissions for it.")) return;

        try {
            await apiService.questions.assessments.delete(id);
            await loadData();
        } catch (err) {
            console.error("Failed to delete assessment:", err);
            alert(`Failed to delete assessment: ${err.message}`);
        }
    };
    const filteredSubmissions = selectedAssessmentFilter
        ? submissions.filter(s => String(s.assessmentId) === String(selectedAssessmentFilter))
        : submissions;

    const pendingSubmissions = filteredSubmissions.filter(s => s.status === 'pending' || !s.status);
    const gradedSubmissions = filteredSubmissions.filter(s => s.status === 'graded');

    // Stats for specific class assessments
    const getClassStats = () => {
        return classes.map(c => ({
            name: c.name,
            count: assessments.filter(a => a.classId === c.id).length
        }));
    };

    const stats = getClassStats();
    const maxAssessmentCount = Math.max(...stats.map(s => s.count), 1);

    const recentActivities = [
        ...classes.map(c => ({
            id: `c_${c.id}`,
            type: 'class',
            title: c.name,
            desc: `Created class ${c.code}`,
            date: c.createdAt || new Date().toISOString(),
            icon: Users
        })),
        ...assessments.map(a => {
            const className = classes.find(c => String(c.id) === String(a.classId))?.name || 'a class';
            return {
                id: `a_${a.id}`,
                type: 'assessment',
                title: a.title,
                desc: `Created assessment for ${className}`,
                date: a.createdAt || new Date().toISOString(),
                icon: ClipboardList
            };
        })
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

    return (
        <>
            <DashboardLayout
                user={user}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogout={onLogout}
                navItems={teacherNav}
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
                    >
                        {/* Dashboard Overview */}
                        {activeTab === 'dashboard' && (
                            <div className="lumina-content-home">
                                <div className="lumina-section-title">
                                    <h2><div className="lumina-icon-indicator" />Command Center</h2>
                                </div>
                                <div className="lumina-bento-grid">
                                    <div className="lumina-card" onClick={() => setActiveTab('classes')} style={{ cursor: 'pointer' }}>
                                        <div className="lumina-stat-header">
                                            <div className="lumina-stat-icon"><Users size={24} /></div>
                                            <ArrowRight size={16} opacity={0.3} />
                                        </div>
                                        <span className="lumina-stat-label">Active Classes</span>
                                        <h3 className="lumina-stat-value">{classes.length}</h3>
                                    </div>
                                    <div className="lumina-card" onClick={() => setActiveTab('assessments')} style={{ cursor: 'pointer' }}>
                                        <div className="lumina-stat-header">
                                            <div className="lumina-stat-icon"><ClipboardList size={24} /></div>
                                            <ArrowRight size={16} opacity={0.3} />
                                        </div>
                                        <span className="lumina-stat-label">Total Assessments</span>
                                        <h3 className="lumina-stat-value">{assessments.length}</h3>
                                    </div>
                                    <div className="lumina-card" onClick={() => setActiveTab('results')} style={{ cursor: 'pointer' }}>
                                        <div className="lumina-stat-header">
                                            <div className="lumina-stat-icon" style={{ color: 'var(--lumina-teal)' }}><Clock size={24} /></div>
                                            <ArrowRight size={16} opacity={0.3} />
                                        </div>
                                        <span className="lumina-stat-label">Pending Reviews</span>
                                        <h3 className="lumina-stat-value">{pendingSubmissions.length}</h3>
                                    </div>
                                </div>

                                <div className="lumina-section-title">
                                    <h2><div className="lumina-icon-indicator" />Recent Activity</h2>
                                    <button className="lumina-btn-secondary" style={{ padding: '6px 16px', fontSize: 11 }} onClick={() => setShowCreateClassModal(true)}>+ NEW CLASS</button>
                                </div>
                                <div className="lumina-card" style={{ padding: 24 }}>
                                    {recentActivities.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            {recentActivities.map(activity => (
                                                <div key={activity.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'var(--lumina-bg-secondary)', borderRadius: 12 }}>
                                                    <div className="lumina-stat-icon" style={{ padding: 10, background: 'var(--lumina-bg)', borderRadius: 8, color: 'var(--lumina-primary)' }}>
                                                        <activity.icon size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 style={{ margin: 0, color: 'var(--lumina-text)', fontSize: 14, fontWeight: 600 }}>{activity.title}</h4>
                                                        <p style={{ margin: '4px 0 0', color: 'var(--lumina-text-dim)', fontSize: 13 }}>{activity.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', opacity: 0.8, padding: 20 }}>
                                            <p style={{ color: 'var(--lumina-text-dim)' }}>Quickly access your class management or assessment reviews by clicking the stats cards above.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Classes Tab */}
                        {activeTab === 'classes' && (
                            <div className="lumina-content-secondary">
                                <AnimatePresence mode="wait">
                                    {!selectedClass ? (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="class-list">
                                            <div className="lumina-section-title">
                                                <h2><div className="lumina-icon-indicator" />My Classes</h2>
                                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--lumina-border)', borderRadius: 12, padding: '4px 8px', alignItems: 'center', gap: 8 }}>
                                                        <input
                                                            placeholder="Link Class Code..."
                                                            value={linkCode}
                                                            onChange={e => setLinkCode(e.target.value)}
                                                            style={{ background: 'none', border: 'none', color: 'var(--lumina-text-main, #09090b)', fontSize: 11, width: 120, padding: '4px 8px' }}
                                                        />
                                                        <button
                                                            onClick={handleLinkClass}
                                                            style={{ background: 'var(--lumina-teal)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 10, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                                        >
                                                            <Link size={12} /> LINK
                                                        </button>
                                                    </div>
                                                    <button className="lumina-btn-elite" style={{ width: 'auto' }} onClick={() => setShowCreateClassModal(true)}>CREATE CLASS</button>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
                                                {classes.map(c => (
                                                    <div key={c.id} className="lumina-card" onClick={() => setSelectedClass(c)} style={{ cursor: 'pointer', position: 'relative' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                                            <div style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--lumina-teal)', padding: 12, borderRadius: 12 }}>
                                                                <BookOpen size={24} />
                                                            </div>
                                                            <button
                                                                onClick={(e) => handleDeleteClass(e, c.id)}
                                                                style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}
                                                                title="Delete Class"
                                                            >
                                                                <Trash2 size={14} /> DELETE
                                                            </button>
                                                        </div>
                                                        <h3 style={{ margin: '0 0 4px' }}>{c.name}</h3>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Code: {c.code}</p>
                                                            <button
                                                                onClick={(e) => handleCopyCode(e, c.code)}
                                                                style={{ background: 'none', border: 'none', color: 'var(--lumina-teal)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}
                                                                title="Copy Class Code"
                                                            >
                                                                {copiedCode === c.code ? <Check size={14} /> : <Copy size={14} opacity={0.5} />}
                                                            </button>
                                                        </div>
                                                        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div style={{ fontSize: 11, fontWeight: 700 }}>{assessments.filter(a => a.classId === c.id).length} ASSESSMENTS</div>
                                                            <ArrowRight size={16} opacity={0.5} />
                                                        </div>
                                                    </div>
                                                ))}
                                                {classes.length === 0 && (
                                                    <div className="lumina-card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60 }}>
                                                        <Users size={40} opacity={0.2} style={{ margin: '0 auto 16px' }} />
                                                        <p>No classes found. Start by creating your first classroom.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key="class-detail">
                                            <div className="lumina-section-title">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                    <button onClick={() => setSelectedClass(null)} className="lumina-btn-back">
                                                        <ChevronLeft size={20} />
                                                    </button>
                                                    <h2 style={{ textTransform: 'uppercase' }}>{selectedClass.name} Assessments</h2>
                                                </div>
                                                <button className="lumina-btn-elite" style={{ width: 'auto' }} onClick={() => setShowCreateAssessmentModal(true)}>+ NEW ASSESSMENT</button>
                                            </div>

                                            <div className="lumina-card" style={{ padding: 0 }}>
                                                <table className="lumina-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--lumina-border)', background: 'rgba(0,0,0,0.2)' }}>
                                                            <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>TITLE</th>
                                                            <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>QUESTIONS</th>
                                                            <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>DURATION</th>
                                                            <th style={{ padding: '16px 24px', textAlign: 'right' }}></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {assessments.filter(a => a.classId === selectedClass.id).length === 0 ? (
                                                            <tr><td colSpan="4" style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>No assessments found for this class.</td></tr>
                                                        ) : (
                                                            assessments.filter(a => a.classId === selectedClass.id).map(a => (
                                                                <tr key={a.id} style={{ borderBottom: '1px solid var(--lumina-border)' }}>
                                                                    <td style={{ padding: '20px 24px', fontWeight: 700 }}>{a.title}</td>
                                                                    <td style={{ padding: '20px 24px' }}>{a.questions?.length || 0} Items</td>
                                                                    <td style={{ padding: '20px 24px' }}>{a.duration || 30} mins</td>
                                                                    <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                                        <button onClick={() => { setSelectedAssessmentFilter(a.id); setActiveTab('results'); }} style={{ background: 'none', border: 'none', color: 'var(--lumina-teal)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>VIEW RESULTS</button>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                            </div>

                        )}

                        {/* Assessments Tab - Full List */}
                        {activeTab === 'assessments' && (
                            <div className="lumina-content-secondary">
                                <div className="lumina-section-title">
                                    <h2><div className="lumina-icon-indicator" />Global Assessments</h2>
                                    <button className="lumina-btn-elite" style={{ width: 'auto' }} onClick={() => setShowCreateAssessmentModal(true)}>CREATE ASSESSMENT</button>
                                </div>

                                <div className="lumina-card" style={{ padding: 0 }}>
                                    <table className="lumina-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--lumina-border)', background: 'rgba(0,0,0,0.2)' }}>
                                                <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>ASSESSMENT NAME</th>
                                                <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>ASSOCIATED CLASS</th>
                                                <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>ITEMS</th>
                                                <th style={{ padding: '16px 24px', textAlign: 'right' }}>ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {assessments.length === 0 ? (
                                                <tr><td colSpan="4" style={{ padding: 60, textAlign: 'center', opacity: 0.5 }}>No assessments deployed yet.</td></tr>
                                            ) : (
                                                assessments.map(a => {
                                                    const className = classes.find(c => c.id === a.classId)?.name || 'Unknown Class';
                                                    return (
                                                        <tr key={a.id} style={{ borderBottom: '1px solid var(--lumina-border)' }}>
                                                            <td style={{ padding: '20px 24px', fontWeight: 700 }}>{a.title}</td>
                                                            <td style={{ padding: '20px 24px' }}>
                                                                <span style={{ background: 'rgba(167, 139, 250, 0.1)', color: 'var(--lumina-purple)', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                                                    {className.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '20px 24px' }}>{a.questions?.length || 0} questions</td>
                                                            <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                                                    <button
                                                                        onClick={() => { setSelectedAssessmentFilter(a.id); setActiveTab('results'); }}
                                                                        style={{ background: 'none', border: 'none', color: 'var(--lumina-teal)', cursor: 'pointer' }}
                                                                        title="Review/Grade Submissions"
                                                                    >
                                                                        <FileText size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteAssessment(a.id)}
                                                                        style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }}
                                                                        title="Delete Assessment"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Results / Submissions Tab */}
                        {activeTab === 'results' && (
                            <div className="lumina-content-secondary">
                                <div className="lumina-section-title">
                                    <div>
                                        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>Submissions</h2>
                                        <p style={{ color: 'var(--lumina-text-dim)', margin: '4px 0 0' }}>
                                            {selectedAssessmentFilter ? `Filtering by Assessment: ${assessments.find(a => String(a.id) === String(selectedAssessmentFilter))?.title || selectedAssessmentFilter}` : 'Review and grade student work.'}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        {selectedAssessmentFilter && (
                                            <button onClick={() => setSelectedAssessmentFilter(null)} className="lumina-btn-secondary" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                                                <X size={16} /> CLEAR FILTER
                                            </button>
                                        )}
                                        <button onClick={handleExportCSV} className="lumina-btn-secondary" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                                            <Download size={16} /> EXPORT CSV
                                        </button>
                                    </div>
                                </div>
                                <div className="lumina-bento-grid" style={{ marginTop: 32, marginBottom: 32 }}>
                                    <div className="lumina-card" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--lumina-gold)', padding: 12, borderRadius: 12 }}><Clock size={24} /></div>
                                        <div><h3 style={{ margin: 0, fontSize: 24 }}>{pendingSubmissions.length}</h3><span className="lumina-stat-label">Pending</span></div>
                                    </div>
                                    <div className="lumina-card" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: 12, borderRadius: 12 }}><CheckCircle2 size={24} /></div>
                                        <div><h3 style={{ margin: 0, fontSize: 24 }}>{gradedSubmissions.length}</h3><span className="lumina-stat-label">Graded</span></div>
                                    </div>
                                </div>

                                <div className="lumina-card" style={{ padding: 0 }}>
                                    <table className="lumina-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--lumina-border)', background: 'rgba(0,0,0,0.2)' }}>
                                                <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>STUDENT</th>
                                                <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>ASSESSMENT</th>
                                                <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>SCORE</th>
                                                <th style={{ padding: '16px 24px', fontSize: 11, color: 'var(--lumina-text-muted)' }}>STATUS</th>
                                                <th style={{ padding: '16px 24px', textAlign: 'right' }}>ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {submissions.length === 0 ? (
                                                <tr><td colSpan="5" style={{ padding: 60, textAlign: 'center', opacity: 0.5 }}>No student submissions yet.</td></tr>
                                            ) : (
                                                submissions.map(s => {
                                                    const a = assessments.find(as => String(as.id) === String(s.assessmentId));
                                                    return (
                                                        <tr key={s.id} style={{ borderBottom: '1px solid var(--lumina-border)' }}>
                                                            <td style={{ padding: '20px 24px' }}>
                                                                <div style={{ fontWeight: 700 }}>{s.studentEmail.split('@')[0]}</div>
                                                                <div style={{ fontSize: 11, opacity: 0.6 }}>{s.studentEmail}</div>
                                                            </td>
                                                            <td style={{ padding: '20px 24px' }}>{a?.title || 'Unknown Assessment'}</td>
                                                            <td style={{ padding: '20px 24px' }}>
                                                                {s.status === 'graded' ? (
                                                                    <span style={{ fontWeight: 800, color: s.percentage >= 70 ? 'var(--lumina-teal)' : 'var(--lumina-purple)' }}>{s.percentage}%</span>
                                                                ) : (
                                                                    <span style={{ opacity: 0.4 }}>—</span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '20px 24px' }}>
                                                                {s.status === 'graded' ? (
                                                                    <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>GRADED</span>
                                                                ) : (
                                                                    <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--lumina-gold)', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>
                                                                        {['MCQ', 'mcq', 'MSQ', 'msq', 'True / False', 'Matching'].includes(a?.type) ? 'PENDING' : 'NEEDS REVIEW'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                                                {!['MCQ', 'mcq', 'MSQ', 'msq', 'True / False', 'Matching'].includes(a?.type) && (
                                                                    <button
                                                                        onClick={() => setSelectedSubmission(s)}
                                                                        className="lumina-btn-secondary"
                                                                        style={{ padding: '6px 14px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                                        disabled={s.status === 'graded'}
                                                                    >
                                                                        Review <ChevronRight size={14} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}


                    </motion.div>
                </AnimatePresence>

                {/* CLASS STATS MODAL - FIXED GRAPH */}
                <AnimatePresence>
                    {showStatsModal && (
                        <motion.div className="lumina-modal-overlay" data-lenis-prevent initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <motion.div className="lumina-profile-modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} style={{ maxWidth: 600 }}>
                                <div className="lumina-modal-header" style={{ marginBottom: 32 }}>
                                    <h2 style={{ fontSize: 18 }}>CLASS PERFORMANCE ANALYTICS</h2>
                                    <button onClick={() => setShowStatsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--lumina-text-main)', cursor: 'pointer' }}><X size={24} /></button>
                                </div>

                                {/* Visual Bar Chart */}
                                <div style={{ background: '#f8fafc', padding: '40px 32px', borderRadius: 24, border: '1px solid #e2e8f0', marginBottom: 24 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 180, gap: 10 }}>
                                        {stats.map((cs, idx) => {
                                            const h = Math.max(10, (cs.count / maxAssessmentCount) * 100);
                                            return (
                                                <div key={idx} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                                        <span style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: '#0f172a' }}>{cs.count}</span>
                                                        <motion.div
                                                            initial={{ height: 0 }}
                                                            animate={{ height: `${h}%` }}
                                                            style={{
                                                                width: 48,
                                                                background: idx % 2 === 0 ? '#10b981' : '#3b82f6',
                                                                borderRadius: '8px 8px 0 0',
                                                                boxShadow: `0 4px 14px ${idx % 2 === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
                                                                minHeight: 10
                                                            }}
                                                        />
                                                    </div>
                                                    <span style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cs.name}</span>
                                                </div>
                                            );
                                        })}
                                        {stats.length === 0 && <p style={{ width: '100%', textAlign: 'center', color: '#64748b' }}>Creating assessments will populate this graph.</p>}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gap: 12, maxHeight: 200, overflowY: 'auto', paddingRight: 8 }}>
                                    {stats.map((cs, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{cs.name}</span>
                                            <span style={{ color: idx % 2 === 0 ? '#10b981' : '#3b82f6', fontWeight: 800 }}>{cs.count} Assessments Assigned</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showCreateClassModal && <CreateClassModal onClose={() => setShowCreateClassModal(false)} onCreate={async (className) => {
                        try {
                            await apiService.courses.create({ title: className, description: "Class created via dashboard" });
                            await loadData();
                            setShowCreateClassModal(false);
                        } catch (err) {
                            console.error("API class creation failed", err);
                            alert("Failed to create class: " + err.message);
                        }
                    }} />}
                    {showCreateAssessmentModal && <CreateAssessmentModal classes={classes} onClose={() => setShowCreateAssessmentModal(false)} onCreate={async (data) => {
                        try {
                            await apiService.questions.assessments.create(data);
                            await loadData();
                            setShowCreateAssessmentModal(false);
                        } catch (err) {
                            console.error("Assessment creation failed:", err);
                            alert(`Failed to create assessment: ${err.message}`);
                        }
                    }} />}
                </AnimatePresence>

                <AnimatePresence>
                    {selectedSubmission && (
                        <ReviewCenterModal
                            submission={selectedSubmission}
                            assessment={assessments.find(a => a.id === selectedSubmission.assessmentId)}
                            onClose={() => setSelectedSubmission(null)}
                            onSave={handleGradeSubmission}
                        />
                    )}
                </AnimatePresence>
            </DashboardLayout>
        </>
    );
}


