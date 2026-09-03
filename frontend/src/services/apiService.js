const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getHeaders = (includeAuth = false, isFormData = false) => {
    const headers = {};
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    if (includeAuth) {
        const token = localStorage.getItem('access_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    return headers;
};

const handleResponse = async (response) => {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        if (response.status === 401) {
            // Auto-logout on token expiration or invalid credentials
            localStorage.removeItem('current_user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/'; 
            throw new Error('Session expired. Please log in again.');
        }

        let errorMsg = data?.message || 'API request failed';
        if (data?.detail) {
            if (typeof data.detail === 'string') {
                errorMsg = data.detail;
            } else if (Array.isArray(data.detail)) {
                errorMsg = data.detail.map(e => `${e.loc?.[e.loc.length-1]}: ${e.msg}`).join(', ');
            } else {
                errorMsg = JSON.stringify(data.detail);
            }
        }
        throw new Error(errorMsg);
    }
    return data;
};

export const apiService = {
    // quick ping to see if the server is up
    health: {
        liveness: async () => handleResponse(await fetch(`${BASE_URL}/`)),
    },

    // auth
    login: async (email, password) => {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email, password }),
        });
        return handleResponse(response);
    },
    register: async (userData) => {
        // backend expects snake_case for children_emails
        const payload = {
            name: userData.name,
            email: userData.email,
            password: userData.password,
            role: userData.role,
            children_emails: userData.childrenEmails || []
        };
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        return await handleResponse(response);
    },
    logout: async () => {
        return { success: true };
    },
    auth: {
        // not wired up yet — returns success so the UI doesn't crash
        forgotPassword: async () => ({ success: true }),
        resetPassword: async () => ({ success: true }),
    },

    // classes
    courses: {
        enroll: async (code) => handleResponse(await fetch(`${BASE_URL}/classes/join`, {
            method: 'POST', headers: getHeaders(true), body: JSON.stringify({ code })
        })),
        my: async () => handleResponse(await fetch(`${BASE_URL}/classes/my-classes`, {
            method: 'GET', headers: getHeaders(true)
        })),
        list: async () => handleResponse(await fetch(`${BASE_URL}/classes/my-classes`, {
            method: 'GET', headers: getHeaders(true)
        })),
        create: async (data) => handleResponse(await fetch(`${BASE_URL}/classes/create`, {
            method: 'POST', headers: getHeaders(true), body: JSON.stringify({ name: data.title || data.name })
        })),
        delete: async (id) => handleResponse(await fetch(`${BASE_URL}/classes/${id}`, {
            method: 'DELETE', headers: getHeaders(true)
        })),
    },

    // documents (PDF upload → text extraction)
    documents: {
        list: async () => handleResponse(await fetch(`${BASE_URL}/documents/get-documents`, {
            method: 'GET', headers: getHeaders(true)
        })),
        upload: async (courseId, title, file) => {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('file', file);
            return handleResponse(await fetch(`${BASE_URL}/documents/upload-pdf`, {
                method: 'POST', headers: getHeaders(true, true), body: formData
            }));
        },
        delete: async (id) => handleResponse(await fetch(`${BASE_URL}/documents/delete-document/${id}`, {
            method: 'DELETE', headers: getHeaders(true)
        }))
    },

    // quizzes & submissions
    questions: {
        generate: async (data) => {
            // rename camelCase fields to what the backend expects
            const payload = {
                title: data.title || "Generated Assessment",
                class_id: parseInt(data.classId),
                type: data.type || "hybrid",
                difficulty: data.difficulty || "medium",
                bloom_level: data.bloomLevel || "application",
                total_marks: parseInt(data.totalMarks) || 10,
                duration: parseInt(data.duration) || 30,
                negative_marks: parseFloat(data.negativeMarks) || 0,
                deadline: data.deadline || null,
                document_id: data.documentId ? parseInt(data.documentId) : null
            };
            return handleResponse(await fetch(`${BASE_URL}/quizzes/generate-quiz`, {
                method: 'POST', headers: getHeaders(true), body: JSON.stringify(payload)
            }));
        },
        
        assessments: {
            my: async () => handleResponse(await fetch(`${BASE_URL}/quizzes/get-quizzes`, { method: 'GET', headers: getHeaders(true) })),
            get: async (id) => handleResponse(await fetch(`${BASE_URL}/quizzes/get-quiz/${id}`, { method: 'GET', headers: getHeaders(true) })),
            create: async (data) => {
                const payload = {
                    title: data.title,
                    class_id: parseInt(data.classId),
                    type: data.type || "hybrid",
                    difficulty: data.difficulty || "medium",
                    bloom_level: data.bloomLevel || "application",
                    total_marks: parseFloat(data.totalMarks) || 10,
                    duration: parseInt(data.duration) || 30,
                    negative_marks: parseFloat(data.negativeMarks) || 0,
                    deadline: data.deadline || null,
                    questions: (data.questions || []).map((q, idx) => ({
                        id: q.id || `q_${idx + 1}`,
                        text: q.text || q.question_text || "",
                        question_text: q.text || q.question_text || "",
                        type: String(q.type || 'mcq').toLowerCase(),
                        options: q.options || [],
                        correct: q.correct || q.correct_answer || q.correctAnswer || "",
                        correct_answer: q.correct || q.correct_answer || q.correctAnswer || "",
                        correctAnswer: q.correct || q.correct_answer || q.correctAnswer || "",
                        marks: parseFloat(q.maxMarks) || parseFloat(q.marks) || 1,
                        maxMarks: parseFloat(q.maxMarks) || parseFloat(q.marks) || 1
                    }))
                };
                return handleResponse(await fetch(`${BASE_URL}/quizzes/create-quiz`, { method: 'POST', headers: getHeaders(true), body: JSON.stringify(payload) }));
            },
            list: async () => handleResponse(await fetch(`${BASE_URL}/quizzes/get-quizzes`, { method: 'GET', headers: getHeaders(true) })),
            delete: async (id) => handleResponse(await fetch(`${BASE_URL}/quizzes/delete-quiz/${id}`, { method: 'DELETE', headers: getHeaders(true) })),

            delivery: {
                start: async () => ({ success: true }),
                save: async () => ({ success: true }),
                // quiz_id is a path param, not in the body
                submit: async (assessmentId, data) => handleResponse(await fetch(`${BASE_URL}/quizzes/submit-answers/${parseInt(assessmentId)}`, {
                    method: 'POST', headers: getHeaders(true), body: JSON.stringify({
                        answers: data.answers || {}
                    })
                })),
            }
        },
        
        submissions: {
            // role-aware: teacher sees their quizzes' submissions, student sees their own
            list: async (filters = {}) => {
                let url = `${BASE_URL}/submissions/get-submissions`;
                const params = [];
                if (filters.student_id) params.push(`student_id=${filters.student_id}`);
                if (filters.assessment_id) params.push(`quiz_id=${filters.assessment_id}`);
                if (params.length) url += '?' + params.join('&');
                return handleResponse(await fetch(url, { method: 'GET', headers: getHeaders(true) }));
            },
            // teacher saves a manual grade + feedback
            override: async (id, data) => handleResponse(await fetch(`${BASE_URL}/submissions/${id}/grade`, {
                method: 'PATCH', headers: getHeaders(true), body: JSON.stringify({ manual_score: parseFloat(data.override_score) || 0, feedback: data.reason || '' })
            }))
        }
    },

    // admin
    admin: {
        users: {
            list: async () => handleResponse(await fetch(`${BASE_URL}/admin/users`, { method: 'GET', headers: getHeaders(true) })),
            updateStatus: async (id, status) => handleResponse(await fetch(`${BASE_URL}/admin/users/${id}/status`, { 
                method: 'PATCH', headers: getHeaders(true), body: JSON.stringify({ status }) 
            }))
        },
        dashboard: {
            stats: async () => handleResponse(await fetch(`${BASE_URL}/admin/stats`, { method: 'GET', headers: getHeaders(true) }))
        },
        courses: {
            list: async () => handleResponse(await fetch(`${BASE_URL}/admin/classes`, { method: 'GET', headers: getHeaders(true) }))
        }
    },
    
    // parent dashboard
    parent: {
        children: async () => handleResponse(await fetch(`${BASE_URL}/parent/children`, { method: 'GET', headers: getHeaders(true) })),
        linkChild: async (data) => handleResponse(await fetch(`${BASE_URL}/parent/link-child`, { 
            method: 'POST', headers: getHeaders(true), body: JSON.stringify(data) 
        }))
    }
};

export default apiService;
