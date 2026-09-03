import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import { 
  X, 
  User, 
  Shield, 
  Camera, 
  Key, 
  Mail, 
  Edit3,
  CheckCircle2,
  AlertCircle 
} from 'lucide-react';
import apiService from '../../services/apiService';

const ProfileModal = ({ user, onClose, onUpdate }) => {
    const [activeSection, setActiveSection] = useState('personal'); // personal, security
    const [formData, setFormData] = useState({
        name: user?.name || '',
        displayName: user?.displayName || user?.name || '',
        bio: user?.bio || 'No bio yet...',
        email: user?.email || '',
        resetCode: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordResetMode, setPasswordResetMode] = useState(false);
    const [loadingReset, setLoadingReset] = useState(false);
    const [profilePic, setProfilePic] = useState(user?.profilePic || null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const fileInputRef = useRef(null);
    const scrollRef = useRef(null);

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

    const [mySubmissionsCount, setMySubmissionsCount] = useState(0);
    const [myCreatedCount, setMyCreatedCount] = useState(0);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                if (user?.role?.toLowerCase() === 'student') {
                    const subs = await apiService.questions.submissions.list();
                    if (subs) setMySubmissionsCount(subs.length);
                } else if (user?.role?.toLowerCase() === 'teacher') {
                    const assessments = await apiService.questions.assessments.list();
                    if (assessments) setMyCreatedCount(assessments.length);
                }
            } catch (e) {
                console.error("Failed to fetch stats for profile", e);
            }
        };
        fetchStats();
    }, [user]);

    const isStudent = user?.role?.toLowerCase() === 'student';
    const statLabel = isStudent ? 'COMPLETED' : 'CREATED';
    const statCount = isStudent ? mySubmissionsCount : myCreatedCount;

    const handleAvatarClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePic(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateInfo = () => {
        // Currently, no API endpoint to update profile info exists in apiService.
        // Assuming we just update the app state via onUpdate.
        // If an endpoint is added, it should be called here (e.g., apiService.auth.updateProfile)
        const updatedUser = { 
            ...user, 
            name: formData.name, 
            displayName: formData.displayName, 
            bio: formData.bio,
            profilePic: profilePic 
        };
        onUpdate(updatedUser);
        setMessage({ type: 'success', text: 'Personal information updated successfully!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    };

    const handleRequestReset = async () => {
        setLoadingReset(true);
        try {
            await apiService.auth.forgotPassword(user.email);
            setMessage({ type: 'success', text: 'Reset code sent to your email!' });
            setPasswordResetMode(true);
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to send reset code.' });
        } finally {
            setLoadingReset(false);
        }
    };

    const handlePasswordChange = async () => {
        if (!formData.resetCode || !formData.newPassword || !formData.confirmPassword) {
            setMessage({ type: 'error', text: 'Please fill all password fields.' });
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.' });
            return;
        }

        if (formData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
            return;
        }

        setLoadingReset(true);
        try {
            await apiService.auth.resetPassword(formData.resetCode, formData.newPassword);
            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setFormData(prev => ({ ...prev, resetCode: '', newPassword: '', confirmPassword: '' }));
            setPasswordResetMode(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to reset password.' });
        } finally {
            setLoadingReset(false);
        }
    };

    return (
        <motion.div 
            className="lumina-modal-overlay"
            data-lenis-prevent
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div 
                className="lumina-profile-modal"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
            >
                <div className="lumina-modal-header">
                    <h2>ACCOUNT SETTINGS</h2>
                    <button className="lumina-modal-close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--lumina-text-main)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="lumina-modal-content" ref={scrollRef} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div style={{ minHeight: '100%', paddingBottom: '32px' }}>
                    {message.text && (
                        <div style={{ 
                            marginBottom: 24, 
                            padding: '12px 16px', 
                            borderRadius: 12, 
                            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                            border: `1px solid ${message.type === 'success' ? '#10b981' : '#f43f5e'}`,
                            color: message.type === 'success' ? '#10b981' : '#f43f5e',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            fontSize: 14,
                            fontWeight: 600
                        }}>
                            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            {message.text}
                        </div>
                    )}

                    <div className="lumina-profile-header-strip">
                        <div className="lumina-profile-avatar-large" onClick={handleAvatarClick} style={{ cursor: 'pointer' }}>
                            {profilePic ? (
                                <img src={profilePic} alt="Avatar" className="lumina-avatar-img" />
                            ) : (
                                <div className="lumina-avatar-fallback">
                                    {user?.name?.charAt(0) || 'U'}
                                </div>
                            )}
                            <div className="lumina-avatar-edit-badge">
                                <Camera size={16} />
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                style={{ display: 'none' }} 
                                onChange={handleFileChange}
                                accept="image/*"
                            />
                        </div>
                        <div className="lumina-profile-top-info" style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h1>{formData.name}</h1>
                                    <p>{user?.role} • {user?.email}</p>
                                </div>

                            </div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                                <button className="lumina-btn-primary" style={{ padding: '8px 20px', fontSize: 12 }} onClick={handleAvatarClick}>UPLOAD NEW AVATAR</button>
                            </div>
                        </div>
                    </div>

                    <div className="lumina-profile-grid">
                        {/* Personal Information */}
                        <div className="lumina-profile-section-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div className="lumina-section-header">
                                <User size={18} style={{ color: 'var(--lumina-teal)' }} />
                                Personal Information
                            </div>

                            <div style={{ flex: 1 }}>
                                <div className="lumina-form-group">
                                    <label>Full Name</label>
                                    <input 
                                        className="lumina-form-input" 
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div className="lumina-form-group">
                                    <label>Display Name</label>
                                    <input 
                                        className="lumina-form-input" 
                                        value={formData.displayName}
                                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                    />
                                </div>

                            </div>

                            <button className="lumina-btn-secondary" style={{ width: '100%', marginTop: 'auto' }} onClick={handleUpdateInfo}>
                                <Edit3 size={16} style={{ marginRight: 8 }} />
                                UPDATE INFO
                            </button>
                        </div>


                    </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default ProfileModal;
