import { useState } from 'react';
import './CreateClassModal.css';



// --- NEW REBUILT COMPONENT ---
function CreateClassModal({ onClose, onCreate }) {
    console.log('CORRECT FILE LOADED');
    const [className, setClassName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (className.trim() === '') {
            alert('Class name cannot be blank!');
            return;
        }
        onCreate(className.trim());
        onClose();
    };

    return (
        <div className="modal-overlay" data-lenis-prevent onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>

                <div className="modal-header">
                    <h2>Create New Class</h2>
                    <button className="close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                <p className="modal-description">Create a new class for your students.</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Class Name</label>
                        <input
                            type="text"
                            placeholder="e.g., Mathematics 101"
                            value={className}
                            onChange={(e) => setClassName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-cancel"
                            style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="btn-action-primary"
                            style={{ padding: '10px 24px', borderRadius: '8px', background: '#18181B', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Create Class
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}

export default CreateClassModal;
