import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LayoutDashboard, 
    Users, 
    ShieldCheck, 
    TrendingUp, 
    Target,
    ClipboardList,
    UserPlus,
    Check,
    ChevronDown,
    X,
    AlertCircle,
    Award,
    Activity,
    BrainCircuit,
    ChevronRight,
    Mail
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import apiService from '../../services/apiService';
import '../../styles/DashboardStyles.css';

export default function ParentDashboard({ user, onLogout, onUserUpdate }) {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [childrenData, setChildrenData] = useState([]);
    const [selectedChildIndex, setSelectedChildIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showSelector, setShowSelector] = useState(false);
    const [showAddChildModal, setShowAddChildModal] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [expandedResult, setExpandedResult] = useState(null);

    const [newChildEmail, setNewChildEmail] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const parentNav = [
        { key: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
        { key: 'children', icon: Users, label: 'Children' },
        { key: 'performance', icon: TrendingUp, label: 'Performance' },
        { key: 'results', icon: ShieldCheck, label: 'Full Logs' },
    ];


    const loadData = async () => {
        setLoading(true);
        try {
            const children = await apiService.parent.children();
            if (children && Array.isArray(children)) {
                const formattedChildren = children.map(c => ({
                    ...c,
                    avgScore: c.avg_score,
                    completedCount: c.completed_count,
                    classesJoined: c.classes_joined,
                    results: c.results ? c.results.map(r => ({
                        ...r,
                        assessmentTitle: r.assessment_title,
                        className: r.class_name
                    })) : []
                }));
                setChildrenData(formattedChildren);
            }
        } catch(e) {
            console.error("Failed to fetch parent dashboard data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [user.childrenEmails]);

    const handleAddChild = async () => {
        if (!newChildEmail) { setActionError('Please enter a student email.'); return; }
        setActionLoading(true);
        setActionError('');
        try {
            if (user.childrenEmails?.includes(newChildEmail)) {
                setActionError('This student is already linked.');
                setActionLoading(false);
                return;
            }
            
            const res = await apiService.parent.linkChild({ email: newChildEmail });
            if (!res || !res.success) throw new Error(res?.detail || 'Failed to add child.');

            const newEmails = [...(user.childrenEmails || []), newChildEmail];
            const updatedUser = { ...user, childrenEmails: newEmails };
            
            // Only update current_user so App.jsx re-renders. 
            // We removed the assessiq_users localStorage mock here.
            localStorage.setItem('current_user', JSON.stringify(updatedUser));
            onUserUpdate(updatedUser);
            setShowAddChildModal(false);
            setNewChildEmail('');
            setActionError('');
        } catch (err) {
            console.error("Failed to link child", err);
            setActionError(err.message || err.detail || 'Failed to add child.');
        } finally {
            setActionLoading(false);
        }
    };

    const closeAddChildModal = () => {
        setShowAddChildModal(false);
        setNewChildEmail('');
        setActionError('');
    };

    const selectedChild = childrenData[selectedChildIndex] || null;

    if (loading) return <div className="lumina-loading">Synchronizing with educational nodes...</div>;

    return (
        <DashboardLayout
            user={user}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onLogout={onLogout}
            navItems={parentNav}
            onUserUpdate={onUserUpdate}
            hideStatus={true}
            onStatsClick={() => setShowStatsModal(true)}
            headerWidget={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Add Child Button */}
                    <button
                        onClick={() => setShowAddChildModal(true)}
                        title="Add a child"
                        style={{
                            width: 38, height: 38, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.04)', border: '1px solid var(--lumina-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--lumina-teal)', transition: '0.2s'
                        }}
                    >
                        <UserPlus size={16} />
                    </button>

                    {/* Child Switcher */}
                    <div style={{ position: 'relative' }}>
                        <div
                            style={{ background: 'rgba(0,0,0,0.02)', padding: '6px 14px', borderRadius: 12, border: '1px solid var(--lumina-border)', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => setShowSelector(!showSelector)}
                        >
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--lumina-purple), var(--lumina-teal))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                                {selectedChild?.name?.charAt(0) || 'C'}
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, opacity: 0.6 }}>MONITORING</p>
                                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--lumina-teal)' }}>{selectedChild?.name || 'No Children Linked'}</p>
                            </div>
                            <ChevronDown size={14} opacity={0.5} style={{ transform: showSelector ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
                        </div>

                        <AnimatePresence>
                            {showSelector && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    style={{ position: 'absolute', top: '120%', right: 0, width: 200, background: 'var(--lumina-glass)', backdropFilter: 'blur(20px)', border: '1px solid var(--lumina-border)', borderRadius: 12, padding: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 100 }}
                                >
                                    {childrenData.length === 0 && (
                                        <div style={{ padding: '12px', fontSize: 12, opacity: 0.5, textAlign: 'center' }}>No children linked yet.</div>
                                    )}
                                    {childrenData.map((child, idx) => (
                                        <div
                                            key={child.email}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: selectedChildIndex === idx ? 'rgba(0,0,0,0.03)' : 'transparent' }}
                                            onClick={() => { setSelectedChildIndex(idx); setShowSelector(false); }}
                                        >
                                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--lumina-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>{child.name.charAt(0)}</div>
                                            <span style={{ fontSize: 13, flex: 1 }}>{child.name}</span>
                                            {selectedChildIndex === idx && <Check size={14} color="var(--lumina-teal)" />}
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            }
        >

            <AnimatePresence mode="wait">
                <motion.div
                    key={`${activeTab}-${selectedChildIndex}`}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.3 }}
                >
                    {/* ── OVERVIEW TAB ── */}
                    {activeTab === 'dashboard' && (
                        <div className="lumina-content-home">
                            {childrenData.length === 0 ? (
                                <div className="lumina-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                                    <UserPlus size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                    <h3>No Children Linked</h3>
                                    <p style={{ opacity: 0.5, marginBottom: 24 }}>Use the + button in the header to link your child's account via email verification.</p>
                                    <button className="lumina-btn-primary" onClick={() => setShowAddChildModal(true)}>Add a Child</button>
                                </div>
                            ) : (
                                <>
                                    <div className="lumina-section-title">
                                        <h2><div className="lumina-icon-indicator" />{selectedChild?.name}'s Summary</h2>
                                    </div>

                                    {selectedChild?.notFound ? (
                                        <div className="lumina-card" style={{ textAlign: 'center', padding: 40 }}>
                                            <AlertCircle size={40} color="#f43f5e" style={{ margin: '0 auto 16px' }} />
                                            <h3>Student Not Found</h3>
                                            <p style={{ opacity: 0.6 }}>The email {selectedChild.email} is not associated with any student account.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="lumina-bento-grid">
                                                <div className="lumina-card">
                                                    <div className="lumina-stat-header">
                                                        <div className="lumina-stat-icon"><Target size={24} /></div>
                                                        <span className="lumina-stat-trend">ACCURACY</span>
                                                    </div>
                                                    <span className="lumina-stat-label">Average Score</span>
                                                    <h3 className="lumina-stat-value">{selectedChild?.avgScore}%</h3>
                                                </div>
                                                <div className="lumina-card">
                                                    <div className="lumina-stat-header">
                                                        <div className="lumina-stat-icon" style={{ color: 'var(--lumina-teal)' }}><ClipboardList size={24} /></div>
                                                    </div>
                                                    <span className="lumina-stat-label">Tests Completed</span>
                                                    <h3 className="lumina-stat-value">{selectedChild?.completedCount}</h3>
                                                </div>
                                                <div className="lumina-card">
                                                    <div className="lumina-stat-header">
                                                        <div className="lumina-stat-icon" style={{ color: 'var(--lumina-gold)' }}><Award size={24} /></div>
                                                    </div>
                                                    <span className="lumina-stat-label">Classes Joined</span>
                                                    <h3 className="lumina-stat-value">{selectedChild?.classesJoined || 0}</h3>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32 }}>
                                                <section>
                                                    <div className="lumina-section-title">
                                                        <h2><div className="lumina-icon-indicator" />Recent Scores</h2>
                                                    </div>
                                                    <div className="lumina-card" style={{ padding: 0 }}>
                                                        {selectedChild?.results.length > 0 ? (
                                                            <table className="lumina-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                <tbody>
                                                                    {selectedChild.results.slice(-4).reverse().map(r => (
                                                                        <tr key={r.assessmentId} style={{ borderBottom: '1px solid var(--lumina-border)' }}>
                                                                            <td style={{ padding: '16px 24px' }}>
                                                                                <div style={{ fontWeight: 700 }}>{r.assessmentTitle}</div>
                                                                                <div style={{ fontSize: 11, opacity: 0.5 }}>{r.className}</div>
                                                                            </td>
                                                                            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                                                <span style={{ color: r.percent > 70 ? 'var(--lumina-teal)' : 'var(--lumina-purple)', fontWeight: 800, fontSize: 16 }}>
                                                                                    {r.percent}%
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        ) : (
                                                            <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>No assessment data found.</div>
                                                        )}
                                                    </div>
                                                </section>

                                                <aside>
                                                    <div className="lumina-section-title">
                                                        <h2><div className="lumina-icon-indicator" style={{ background: 'var(--lumina-gold)' }} />AI Parental Insight</h2>
                                                    </div>
                                                    <div className="lumina-card">
                                                        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                                                            <BrainCircuit size={20} color="var(--lumina-teal)" />
                                                            <p style={{ fontSize: 12, margin: 0, opacity: 0.8 }}>Strong foundations building across completed assessments.</p>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 12 }}>
                                                            <Activity size={20} color="var(--lumina-purple)" />
                                                            <p style={{ fontSize: 12, margin: 0, opacity: 0.8 }}>Average score of {selectedChild?.avgScore}% across {selectedChild?.completedCount} tests.</p>
                                                        </div>
                                                    </div>
                                                </aside>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* ── CHILDREN TAB ── */}
                    {activeTab === 'children' && (
                        <div className="lumina-content-secondary">
                            <div className="lumina-section-title">
                                <h2><div className="lumina-icon-indicator" />Family Directory</h2>
                            </div>
                            {childrenData.length === 0 ? (
                                <div className="lumina-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                                    <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                    <h3>No Children Linked</h3>
                                    <p style={{ opacity: 0.5, marginBottom: 24 }}>Add your child's account to start monitoring their progress.</p>
                                    <button className="lumina-btn-primary" onClick={() => setShowAddChildModal(true)}>Add a Child</button>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                                    {childrenData.map((child, idx) => (
                                        <div key={child.email} className="lumina-card" onClick={() => setSelectedChildIndex(idx)} style={{ cursor: 'pointer', border: selectedChildIndex === idx ? '1px solid var(--lumina-teal)' : '1px solid var(--lumina-border)' }}>
                                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(6,182,212,0.1)', color: 'var(--lumina-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>
                                                    {child.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 style={{ marginBottom: 4 }}>{child.name}</h3>
                                                    <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>{child.email}</p>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--lumina-border)', paddingTop: 16 }}>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: 10, opacity: 0.5, fontWeight: 700 }}>AVG SCORE</p>
                                                    <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--lumina-teal)' }}>{child.avgScore}%</p>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <p style={{ margin: 0, fontSize: 10, opacity: 0.5, fontWeight: 700 }}>COMPLETED</p>
                                                    <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{child.completedCount}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── PERFORMANCE TAB ── */}
                    {activeTab === 'performance' && (
                        <div className="lumina-content-secondary">
                            <div className="lumina-section-title">
                                <h2><div className="lumina-icon-indicator" />Visual Analytics: {selectedChild?.name}</h2>
                            </div>
                            <div className="lumina-card" style={{ background: 'rgba(0,0,0,0.2)', padding: '60px 40px', borderRadius: 32 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 240, gap: 16 }}>
                                    {(selectedChild?.results || []).slice(-7).map((res, idx) => (
                                        <div key={idx} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: `${res.percent}%` }}
                                                style={{
                                                    width: '100%', maxWidth: 50,
                                                    background: res.percent > 80 ? 'linear-gradient(to top, #06b6d4, #22d3ee)' : 'linear-gradient(to top, #8b5cf6, #a78bfa)',
                                                    borderRadius: '12px 12px 4px 4px',
                                                    boxShadow: `0 0 20px ${res.percent > 80 ? 'rgba(6,182,212,0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                                                    position: 'relative'
                                                }}
                                            >
                                                <span style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 800 }}>{res.percent}%</span>
                                            </motion.div>
                                            <span style={{ fontSize: 10, color: 'var(--lumina-text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', maxWidth: 60, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={res.assessmentTitle}>
                                                {res.assessmentTitle || `Test ${idx + 1}`}
                                            </span>
                                        </div>
                                    ))}
                                    {(!selectedChild?.results || selectedChild.results.length === 0) && (
                                        <p style={{ opacity: 0.5 }}>Performance graph will populate after assessments are completed.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── FULL LOGS TAB ── */}
                    {activeTab === 'results' && (
                        <div className="lumina-content-secondary">
                            <div className="lumina-section-title">
                                <h2><div className="lumina-icon-indicator" />Assessment Results — {selectedChild?.name}</h2>
                            </div>

                            {(!selectedChild?.results || selectedChild.results.length === 0) ? (
                                <div className="lumina-card" style={{ textAlign: 'center', padding: 40 }}>
                                    <ClipboardList size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                    <p style={{ opacity: 0.5 }}>No assessments completed yet.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {selectedChild.results.map(r => (
                                        <div key={r.assessmentId} className="lumina-card" style={{ padding: 0, overflow: 'hidden' }}>
                                            {/* Result Row Header */}
                                            <div
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', cursor: 'pointer' }}
                                                onClick={() => setExpandedResult(expandedResult === r.assessmentId ? null : r.assessmentId)}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{r.assessmentTitle}</div>
                                                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                                                        {r.className} • {new Date(r.timestamp || Date.now()).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                    <span style={{
                                                        fontWeight: 800, fontSize: 20,
                                                        color: r.percent > 70 ? 'var(--lumina-teal)' : r.percent > 40 ? 'var(--lumina-gold)' : 'var(--lumina-rose)'
                                                    }}>
                                                        {r.percent}%
                                                    </span>
                                                    <span style={{ fontSize: 12, opacity: 0.5 }}>
                                                        {(r.mcqScore || 0) + (r.manualScore || 0)} / {(r.mcqTotal || 0) + (r.manualTotal || 0)} pts
                                                    </span>
                                                    <motion.div
                                                        animate={{ rotate: expandedResult === r.assessmentId ? 90 : 0 }}
                                                        style={{ color: 'var(--lumina-teal)' }}
                                                    >
                                                        <ChevronRight size={18} />
                                                    </motion.div>
                                                </div>
                                            </div>

                                            {/* Expanded Q&A Breakdown */}
                                            <AnimatePresence>
                                                {expandedResult === r.assessmentId && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        style={{ overflow: 'hidden', borderTop: '1px solid var(--lumina-border)' }}
                                                    >
                                                        <div style={{ padding: '24px' }}>
                                                            <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Question Breakdown</p>
                                                            {r.questions.length === 0 ? (
                                                                <p style={{ opacity: 0.5, fontSize: 13 }}>Detailed question data not available for this assessment.</p>
                                                            ) : (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                                    {r.questions.map((q, qi) => {
                                                                        const studentAnswer = r.answers?.[qi] ?? r.answers?.[q.id] ?? '—';
                                                                        const correctAnswer = q.correctAnswer ?? q.correct ?? '—';
                                                                        const isCorrect = String(studentAnswer).toLowerCase() === String(correctAnswer).toLowerCase();
                                                                        return (
                                                                            <div key={qi} style={{
                                                                                padding: '16px 20px',
                                                                                borderRadius: 12,
                                                                                background: isCorrect ? 'rgba(16, 185, 129, 0.06)' : 'rgba(244, 63, 94, 0.06)',
                                                                                border: `1px solid ${isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`
                                                                            }}>
                                                                                <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14 }}>Q{qi + 1}. {q.question || q.text}</p>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                                    <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                                                                                        <span style={{ opacity: 0.5, minWidth: 140 }}>Child's Answer:</span>
                                                                                        <span style={{ fontWeight: 700, color: isCorrect ? 'var(--lumina-teal)' : 'var(--lumina-rose)' }}>{studentAnswer}</span>
                                                                                    </div>
                                                                                    {!isCorrect && (
                                                                                        <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                                                                                            <span style={{ opacity: 0.5, minWidth: 140 }}>Correct Answer:</span>
                                                                                            <span style={{ fontWeight: 700, color: 'var(--lumina-teal)' }}>{correctAnswer}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    <div style={{ display: 'flex', gap: 8, fontSize: 13, marginTop: 4 }}>
                                                                                        <span style={{ opacity: 0.5, minWidth: 140 }}>Marks:</span>
                                                                                        <span style={{ fontWeight: 700 }}>{isCorrect ? (q.marks || q.points || 1) : 0} / {q.marks || q.points || 1}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* ── ADD CHILD MODAL ── */}
            <AnimatePresence>
                {showAddChildModal && (
                    <motion.div
                        className="lumina-modal-overlay"
                        data-lenis-prevent
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ zIndex: 2000 }}
                    >
                        <motion.div
                            className="lumina-profile-modal"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            style={{ maxWidth: 440, padding: 40 }}
                        >
                            <div className="lumina-modal-header" style={{ marginBottom: 24 }}>
                                <div>
                                    <h2 style={{ fontSize: 22, marginBottom: 8 }}>Link a Child</h2>
                                    <p style={{ margin: 0, opacity: 0.5, fontSize: 13 }}>
                                        Enter your child's registered email to link them to your account.
                                    </p>
                                </div>
                                <button onClick={closeAddChildModal} style={{ background: 'none', border: 'none', color: 'var(--lumina-text-main)', cursor: 'pointer' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Student Email
                                    </label>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <Mail size={16} style={{ position: 'absolute', left: 16, opacity: 0.4 }} />
                                        <input
                                            type="email"
                                            placeholder="child@school.com"
                                            value={newChildEmail}
                                            onChange={e => setNewChildEmail(e.target.value)}
                                            style={{ width: '100%', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--lumina-border)', borderRadius: 14, padding: '14px 16px 14px 42px', color: 'var(--lumina-text-main, #09090b)', outline: 'none', fontSize: 14 }}
                                        />
                                    </div>
                                </div>

                                {actionError && (
                                    <div style={{ color: '#f43f5e', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                                        <AlertCircle size={14} /> {actionError}
                                    </div>
                                )}

                                <button className="lumina-btn-elite" onClick={handleAddChild} disabled={actionLoading} style={{ padding: '14px', borderRadius: 14, fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>
                                    {actionLoading ? 'LINKING...' : 'LINK CHILD'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── PERFORMANCE ANALYTICS MODAL ── */}
            <AnimatePresence>
                {showStatsModal && (
                    <motion.div className="lumina-modal-overlay" data-lenis-prevent initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ zIndex: 2000 }}>
                        <motion.div className="lumina-profile-modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} style={{ maxWidth: 650, width: '90%' }}>
                            <div className="lumina-modal-header" style={{ marginBottom: 32 }}>
                                <div>
                                    <h2 style={{ fontSize: 20, marginBottom: 8, letterSpacing: 1 }}>FAMILY PERFORMANCE ANALYTICS</h2>
                                    <p style={{ margin: 0, opacity: 0.5, fontSize: 12 }}>{childrenData.length > 1 ? 'Comparative analysis of all linked students.' : 'Academic growth progression.'}</p>
                                </div>
                                <button onClick={() => setShowStatsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--lumina-text-main)', cursor: 'pointer' }}><X size={24} /></button>
                            </div>
                            <div style={{ background: 'var(--lumina-glass)', padding: '40px 32px', borderRadius: 24, border: '1px solid var(--lumina-border)', marginBottom: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.05)', backdropFilter: 'blur(10px)' }}>
                                {childrenData.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, opacity: 0.5, fontWeight: 500 }}>Link children to view comparative analytics.</div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 240, gap: 20 }}>
                                        {childrenData.map((child, idx) => (
                                            <div key={idx} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
                                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <span style={{ fontSize: 16, fontWeight: 900, marginBottom: 8, color: idx % 2 === 0 ? 'var(--lumina-teal)' : 'var(--lumina-purple)', textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>{child.avgScore}%</span>
                                                    <motion.div
                                                        initial={{ height: 0 }}
                                                        animate={{ height: `${Math.max(5, child.avgScore)}%` }}
                                                        style={{
                                                            width: '100%', maxWidth: 70,
                                                            background: idx % 2 === 0 ? 'linear-gradient(to top, #06b6d4, #22d3ee)' : 'linear-gradient(to top, #8b5cf6, #a78bfa)',
                                                            borderRadius: '16px 16px 6px 6px',
                                                            boxShadow: `0 4px 20px ${idx % 2 === 0 ? 'rgba(6,182,212,0.4)' : 'rgba(139, 92, 246, 0.4)'}`,
                                                            position: 'relative',
                                                            overflow: 'hidden'
                                                        }}
                                                    >
                                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)' }} />
                                                    </motion.div>
                                                </div>
                                                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', letterSpacing: 0.5 }}>{child.name.split(' ')[0]}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                                {childrenData.map((child, idx) => (
                                    <motion.div 
                                        key={idx} 
                                        className="lumina-card" 
                                        whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.1)' }}
                                        style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid var(--lumina-border)', background: 'var(--lumina-surface)' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: idx % 2 === 0 ? 'var(--lumina-teal)' : 'var(--lumina-purple)', boxShadow: `0 0 10px ${idx % 2 === 0 ? 'var(--lumina-teal)' : 'var(--lumina-purple)'}` }} />
                                            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.2 }}>{child.name}</span>
                                        </div>
                                        <span style={{ fontWeight: 900, fontSize: 18, color: idx % 2 === 0 ? 'var(--lumina-teal)' : 'var(--lumina-purple)' }}>{child.avgScore}%</span>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
