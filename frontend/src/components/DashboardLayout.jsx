import React, { useState, useEffect, useRef } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import ProfileModal from './modals/ProfileModal';
import aiService from '../services/aiService';
import ReactMarkdown from 'react-markdown';
import Lenis from 'lenis';
import { 
  BarChart3, 
  LogOut,
  Zap,
  Flame,
  BrainCircuit,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Send,
  RotateCcw,
  Loader2
} from 'lucide-react';
import '../styles/DashboardStyles.css';

const DashboardLayout = ({ 
  user, 
  activeTab, 
  setActiveTab, 
  onLogout, 
  children,
  navItems = [],
  onUserUpdate,
  onStatsClick,
  headerWidget,
  hideStatus
}) => {
  const [showProfile, setShowProfile] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [tutorInput, setTutorInput] = useState('');
  const [tutorMessages, setTutorMessages] = useState([
    { role: 'ai', text: "Hi! I'm your AI Tutor. Ask me anything about assessments, classes, or performance!" }
  ]);
  const [tutorLoading, setTutorLoading] = useState(false);
  const scrollRef = useRef(null);
  const tutorMessagesEndRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const lenis = new Lenis({
      wrapper: scrollRef.current,
      content: scrollRef.current.firstElementChild,
      lerp: 0.1,
      wheelMultiplier: 1,
    });

    let animationFrameId;
    function raf(time) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }
    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
    };
  }, []);

  // Auto-scroll tutor messages to bottom
  useEffect(() => {
    tutorMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tutorMessages]);

  const handleTutorSend = async () => {
    const msg = tutorInput.trim();
    if (!msg || tutorLoading) return;

    setTutorInput('');
    setTutorMessages(prev => [...prev, { role: 'user', text: msg }]);
    setTutorLoading(true);

    try {
      // Gather context for the AI
      const contextData = {
        classes: JSON.parse(localStorage.getItem('classes') || '[]'),
        assessments: JSON.parse(localStorage.getItem('assessments') || '[]'),
        submissions: JSON.parse(localStorage.getItem('submissions') || '[]')
      };
      
      const reply = await aiService.askTutor(msg, user?.role || 'Unknown User', contextData);
      setTutorMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (err) {
      console.error('AI Tutor API failed:', err);
      setTutorMessages(prev => [
        ...prev,
        { role: 'ai', text: '⚠️ Could not connect to the AI. Please check your connection and try again.' }
      ]);
    } finally {
      setTutorLoading(false);
    }
  };

  const handleTutorNewChat = () => {
    setTutorMessages([{ role: 'ai', text: '👋 New conversation started! What would you like to learn today?' }]);
  };

  const handleNavScroll = () => {
    if (!hasScrolled) {
      setHasScrolled(true);
    }
  };

  return (
    <div className="lumina-dashboard-layout">
      {/* Sidebar - Floating Pill (Centered) */}
      <aside className="lumina-sidebar">
        <nav className="lumina-nav" onScroll={handleNavScroll}>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`lumina-nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              <item.icon size={20} />
              <span className="nav-tooltip">{item.label}</span>
            </button>
          ))}
        </nav>

        {navItems.length > 3 && !hasScrolled && (
          <div className="lumina-scroll-hint">
            <ChevronDown size={12} className="bounce-anim" />
          </div>
        )}

        <div className="lumina-sidebar-footer">
          <button className="lumina-nav-item lumina-sidebar-logout" onClick={onLogout}>
            <LogOut size={18} />
            <span className="nav-tooltip">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lumina-main">
        <header className="lumina-header">
          <div className="lumina-greeting">
            <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              {`Welcome back, ${(user?.displayName || user?.name)?.split(' ')[0] || 'User'}.`}
            </motion.h1>
            <p>
              {user?.role === 'teacher' && 'Manage your classes and assessments with AI precision.'}
              {user?.role === 'student' && 'Level up your intelligence with AI-driven learning.'}
              {user?.role === 'admin' && 'Overseeing the educational ecosystem.'}
              {user?.role === 'parent' && 'Monitoring educational growth and success.'}
            </p>
          </div>
          <div className="lumina-status-badges">
            
            {headerWidget && <div className="lumina-header-custom">{headerWidget}</div>}
            
            {!hideStatus && (
              <>
                <div className="lumina-status-badge-pill">
                  <span className="lumina-status-label">Status</span>
                  <span className="lumina-status-value teal"><Flame size={14} fill="var(--lumina-teal)" /> ACTIVE</span>
                </div>

              </>
            )}

            {onStatsClick && (
              <div style={{ cursor: 'pointer' }} onClick={onStatsClick}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--lumina-glass-light)', border: '1px solid var(--lumina-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.3s' }} className="lumina-stats-btn">
                  <BarChart3 size={18} />
                </div>
              </div>
            )}

            {/* User Avatar - Rightmost Corner */}
            <button 
              onClick={() => setShowProfile(true)} 
              className="lumina-header-avatar"
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
            >
              <div style={{ position: 'relative', width: 40, height: 40 }}>
                {user?.profilePic ? (
                  <img src={user.profilePic} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #3F3F46, #18181B)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                    {(user?.displayName || user?.name)?.charAt(0) || 'U'}
                  </div>
                )}
                <svg style={{ position: 'absolute', top: -3, left: -3, width: 46, height: 46, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
                  <circle cx="23" cy="23" r="21" stroke="rgba(0,0,0,0.06)" strokeWidth="2" fill="none" />
                  <circle cx="23" cy="23" r="21" stroke="var(--lumina-teal)" strokeWidth="2" fill="none" strokeDasharray="132" strokeDashoffset="33" strokeLinecap="round" />
                </svg>
              </div>
            </button>
          </div>
        </header>

        <div className="lumina-content-area">
          <div className="lumina-center-content" ref={scrollRef}>
            <div className="lenis-content-wrapper" style={{ minHeight: '100%', paddingBottom: '40px' }}>
              {children}
            </div>
          </div>
          
          {/* AI Tutor Right Panel */}
          {user?.role !== 'Parent' && (
            <div className={`lumina-right-panel-wrapper ${rightPanelOpen ? 'open' : 'closed'}`}>
            {/* Collapse Toggle Button */}
            <button 
              className="lumina-panel-toggle"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              title={rightPanelOpen ? 'Collapse AI Tutor' : 'Expand AI Tutor'}
            >
              {rightPanelOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            <AnimatePresence initial={false}>
              {rightPanelOpen && (
                <motion.aside
                  className="lumina-right-panel"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 280, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Panel Header */}
                  <div className="lumina-tutor-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="lumina-tutor-icon">
                        <BrainCircuit size={18} />
                      </div>
                      <div>
                        <div className="lumina-tutor-title">AI Tutor</div>
                        <div className="lumina-tutor-subtitle">Always online</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="lumina-tutor-send-btn"
                      onClick={handleTutorNewChat}
                      title="New conversation"
                      style={{ width: 28, height: 28, background: 'none', color: 'var(--lumina-text-dim, #94a3b8)', opacity: 0.7 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="lumina-tutor-messages">
                    {tutorMessages.map((msg, i) => (
                      <div key={i} className={`lumina-tutor-msg ${msg.role}`}>
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    ))}
                    {tutorLoading && (
                      <div className="lumina-tutor-msg ai" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.6 }}>
                        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                        <span style={{ fontSize: 13 }}>Thinking…</span>
                      </div>
                    )}
                    <div ref={tutorMessagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="lumina-tutor-input-row" style={{ padding: '12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      className="lumina-tutor-input"
                      placeholder="Ask anything..."
                      value={tutorInput}
                      onChange={(e) => setTutorInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTutorSend(); } }}
                      disabled={tutorLoading}
                    />
                    <button
                      type="button"
                      className="lumina-tutor-send-btn"
                      onClick={handleTutorSend}
                      disabled={tutorLoading || !tutorInput.trim()}
                      aria-label="Send"
                    >
                      {tutorLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                    </button>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
            </div>
          )}
        </div>

        {showProfile && (
          <ProfileModal 
            user={user} 
            onClose={() => setShowProfile(false)} 
            onUpdate={(u) => {
              onUserUpdate(u);
            }} 
          />
        )}
      </main>
    </div>
  );
};

export default DashboardLayout;
