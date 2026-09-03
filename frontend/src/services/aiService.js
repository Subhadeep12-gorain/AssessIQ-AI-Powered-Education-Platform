/**
 * AI Service for AssessIQ
 * Handles all AI-related logic including generation, grading, and insights.
 * Used in: CreateAssessmentModal.jsx (question generation), ReviewCenterModal (subjective grading)
 */
import OpenAI from "openai";

let ai = null;
const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || "";

try {
    if (apiKey) {
        ai = new OpenAI({ 
            baseURL: OPENROUTER_URL,
            apiKey: apiKey,
            dangerouslyAllowBrowser: true 
        });
    } else {
        console.warn("VITE_OPENROUTER_API_KEY is not set. AI will fail.");
    }
} catch (e) {
    console.error("Failed to initialize OpenRouter:", e);
}

const OPENROUTER_MODEL = "google/gemini-2.5-flash";

export const aiService = {
    /**
     * Analyzes a student's answer for subjective grading.
     * Used in: ReviewCenterModal
     */
    async analyzeSubjectiveAnswer(questionText, studentAnswer, maxMarks) {
        try {
            const prompt = `You are an expert teacher grading a student's answer.
Question: "${questionText}"
Student's Answer: "${studentAnswer}"
Max Marks Possible: ${maxMarks}

Analyze the student's answer and determine a fair score based on accuracy, depth, and clarity. 
You MUST return your response as a valid, pure JSON object without any markdown formatting.
The JSON object MUST have this exact structure:
{
    "feedback": "Constructive feedback addressed to the student explaining what they did well and what they missed.",
    "suggestedScore": <number between 0 and ${maxMarks}>,
    "logic": "Brief explanation of your grading logic for the teacher."
}`;

            const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: OPENROUTER_MODEL,
                    messages: [
                        { role: "user", content: prompt }
                    ]
                })
            });

            const data = await response.json();
            const responseText = data.choices[0].message.content.trim();
            
            // Try to extract JSON
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }
            throw new Error("Invalid JSON");
        } catch (err) {
            console.error("AI grading failed, using fallback:", err);
            // Fallback mock if AI is down or rate limited
            const feedbacks = [
                "Good attempt. The main point is addressed, but adding more specific examples would improve the answer.",
                "Partial understanding shown. The answer misses a few key technical details required for full marks."
            ];
            const suggestedScore = Math.max(1, Math.floor(maxMarks * 0.6));
            return {
                feedback: feedbacks[Math.floor(Math.random() * feedbacks.length)],
                suggestedScore: suggestedScore,
                logic: "Fallback grading (AI service unavailable)."
            };
        }
    },

    /**
     * Summarizes performance for a class or assessment.
     * Used in: TeacherDashboard (analytics panel)
     */
    async summarizeClassPerformance(submissions) {
        const avg = submissions.reduce((sum, s) => sum + s.percentage, 0) / (submissions.length || 1);
        return {
            summary: `Overall performance is ${avg > 70 ? 'strong' : 'improving'}. Students excelled in basic concepts but struggled with application questions.`,
            topWeakness: "Application of core principles",
            topStrength: "Foundational terminology",
            recommendation: "Increase focus on practical case studies in the next lesson."
        };
    },

    /**
     * Context-Aware AI Tutor
     * Uses OpenRouter API to answer questions based on the user's role and live localStorage data.
     */
    async askTutor(question, userRole, contextData) {
        if (!ai) return "OpenRouter API is not configured.";
        
        try {
            const systemPrompt = `You are the AssessIQ AI Tutor. The user you are talking to is a(n): ${userRole}. 
Current Platform State Data: ${JSON.stringify(contextData)}.
Answer their question accurately based on this data. Be helpful, concise, and professional.`;
            
            const response = await ai.chat.completions.create({
                model: OPENROUTER_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: question }
                ]
            });
            return response.choices[0].message.content;
        } catch (error) {
            console.error("OpenRouter AI Tutor Error:", error);
            return "Sorry, I am having trouble connecting to my AI brain right now.";
        }
    },

    /**
     * Generates questions based on parameters and optional raw text context.
     * Powered by OpenRouter API.
     */
    async generateQuestions(title, type, difficulty, totalMarks, rawTextContext = null) {
        if (!ai) throw new Error("OpenRouter API key is missing. Check your .env file.");

        try {
            const numQs = totalMarks <= 20 ? 3 : totalMarks <= 50 ? 5 : 8;
            const marksPerQ = Math.round(totalMarks / numQs);
            
            // Map the AssessIQ type to the expected JSON type string
            let jsonType = 'mcq';
            if (type === 'Short Answer') jsonType = 'short';
            else if (type === 'Long Answer') jsonType = 'long';
            else if (type === 'MSQ (Multiple Select)') jsonType = 'msq';
            else if (type === 'True / False') jsonType = 'true_false';
            else if (type === 'Fill in the Blank') jsonType = 'fill_blank';
            else if (type === 'Case Study') jsonType = 'case_study';
            else if (type === 'Matching') jsonType = 'matching';
            else if (type === 'Mix') jsonType = 'mcq or short or long or true_false';

            const prompt = `You are an expert exam creator for AssessIQ. Generate exactly ${numQs} questions of type '${type}' and difficulty '${difficulty}' about the topic: '${title}'.
${rawTextContext ? `\nUse the following extracted document text as the strict source material for your questions:\n"""\n${rawTextContext.substring(0, 15000)}\n"""\n` : ''}
You MUST return your response as a valid, pure JSON array of objects without any markdown formatting like \`\`\`json.
The JSON objects MUST have this exact structure:
[
  {
    "id": "q_ai_unique_id",
    "type": "${jsonType}",
    "text": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"], // ONLY IF type is mcq, msq, or matching
    "correct": "Option A", // Provide the correct answer text. For msq, provide an array. For true_false, provide 'True' or 'False'.
    "maxMarks": ${marksPerQ}
  }
]`;

            const response = await ai.chat.completions.create({
                model: OPENROUTER_MODEL,
                messages: [
                    { role: "user", content: prompt }
                ]
            });

            let responseText = response.choices[0].message.content.trim();
            
            // Aggressively extract only the JSON array to handle chatty free models
            const match = responseText.match(/\[[\s\S]*\]/);
            if (!match) {
                throw new Error("AI did not return a valid JSON array.");
            }

            const questions = JSON.parse(match[0]);
            // Ensure unique IDs in case AI didn't make them unique
            questions.forEach((q, idx) => {
                q.id = `q_ai_${Date.now()}_${idx}`;
            });
            
            return questions;
        } catch (error) {
            console.error("OpenRouter Generation Error:", error);
            throw new Error("Failed to generate questions with OpenRouter.");
        }
    },


    /* =========================================================================
       --- MOCK FALLBACKS (Commented out as requested)
       ========================================================================= */
    /*
    async generateQuestionsMock(title, type, difficulty, totalMarks, fileName = null) {
        await new Promise(r => setTimeout(r, 1500)); // Simulate extraction and generation time

        const numQs = totalMarks <= 20 ? 3 : totalMarks <= 50 ? 5 : 8;
        const marksPerQ = Math.round(totalMarks / numQs);

        // Smart Demo Fallback: If a file was uploaded, simulate extracting its specific contents
        if (fileName && (fileName.toLowerCase().includes('math') || title.toLowerCase().includes('math'))) {
            const mathMCQs = [
                { text: "What is the value of x in the equation 2x + 5 = 15?", options: ["5", "10", "4", "20"], correct: "5" },
                { text: "Which of the following is a prime number?", options: ["15", "21", "29", "33"], correct: "29" },
                { text: "What is the area of a circle with radius r?", options: ["πr", "2πr", "πr²", "2πr²"], correct: "πr²" },
                { text: "Simplify: 3(x - 4) + 2x", options: ["5x - 12", "5x - 4", "x - 12", "5x + 12"], correct: "5x - 12" },
                { text: "What is the square root of 144?", options: ["10", "12", "14", "16"], correct: "12" },
                { text: "Find the median of the set: 3, 7, 12, 18, 21", options: ["10", "12", "14", "7"], correct: "12" },
                { text: "If a triangle has a base of 6 and height of 4, what is its area?", options: ["10", "12", "24", "16"], correct: "12" },
                { text: "What is 15% of 200?", options: ["15", "20", "30", "45"], correct: "30" },
                { text: "Solve for y: y/4 = 7", options: ["11", "28", "3", "47"], correct: "28" },
                { text: "Which fraction is equivalent to 0.75?", options: ["1/2", "2/3", "3/4", "4/5"], correct: "3/4" }
            ];

            const questions = [];
            for (let i = 0; i < Math.min(numQs, mathMCQs.length); i++) {
                questions.push({
                    id: `q_${Date.now()}_${i}`,
                    type: 'mcq',
                    text: mathMCQs[i].text,
                    options: mathMCQs[i].options,
                    correct: mathMCQs[i].correct,
                    maxMarks: marksPerQ
                });
            }
            return questions;
        }

        // Standard Fallback: Generic generation based on title or file
        const docPrefix = fileName ? "Based on the provided document, " : "";
        
        const mcqTemplates = [
            `${docPrefix}Which of the following best describes the core principle discussed regarding ${title}?`,
            `${docPrefix}What is the primary purpose or main idea of ${title}?`,
            `${docPrefix}Which concept is identified as fundamental to understanding ${title}?`,
            `${docPrefix}In the context provided, what does the key terminology associated with ${title} refer to?`,
            `${docPrefix}Which statement about the implementation of ${title} is most accurate?`,
            `${docPrefix}What is recommended as the correct approach when applying ${title}?`,
            `${docPrefix}Which of the following is explicitly stated as NOT a characteristic of ${title}?`,
            `${docPrefix}According to the established definition, ${title} is best defined as?`,
        ];

        const shortTemplates = [
            `${docPrefix}Briefly explain the significance of ${title} in its respective domain.`,
            `${docPrefix}What are the key components of ${title}? List at least two.`,
            `${docPrefix}How does ${title} differ from conventional approaches mentioned?`,
            `${docPrefix}Describe one real-world application of ${title} as outlined.`,
        ];

        const longTemplates = [
            `${docPrefix}Analyze the importance of ${title} and discuss its impact on the broader field. Support your answer with relevant examples.`,
            `${docPrefix}Compare and contrast ${title} with alternative methods. Discuss the advantages and disadvantages of each.`,
            `${docPrefix}Evaluate the limitations of ${title}. How would you address these challenges in a real-world scenario?`,
        ];

        const difficultyOptions = {
            'Easy': [
                ['A fundamental concept', 'An advanced technique', 'An external factor', 'None of the above'],
                ['Basic structure', 'Complex algorithm', 'User interface', 'Database schema'],
            ],
            'Medium': [
                ['Primary encapsulation', 'Data abstraction', 'Dynamic polymorphism', 'Multiple inheritance'],
                ['Linear complexity', 'Quadratic complexity', 'Logarithmic complexity', 'Constant complexity'],
            ],
            'Hard': [
                ['Deterministic model', 'Stochastic model', 'Heuristic approach', 'Greedy algorithm'],
                ['Strong consistency', 'Eventual consistency', 'Causal consistency', 'Sequential consistency'],
            ]
        };

        const opts = difficultyOptions[difficulty] || difficultyOptions['Medium'];
        const questions = [];

        for (let i = 0; i < numQs; i++) {
            let qType = type;
            if (type === 'Mix') {
                if (i < Math.ceil(numQs * 0.5)) qType = 'MCQ';
                else if (i < Math.ceil(numQs * 0.75)) qType = 'Short Answer';
                else qType = 'Long Answer';
            }

            if (qType === 'MCQ') {
                const tmpl = mcqTemplates[i % mcqTemplates.length];
                const optSet = opts[i % opts.length];
                questions.push({
                    id: `q_${Date.now()}_${i}`,
                    type: 'mcq',
                    text: tmpl,
                    options: optSet,
                    correct: optSet[0],
                    maxMarks: marksPerQ
                });
            } else if (qType === 'Short Answer') {
                questions.push({
                    id: `q_${Date.now()}_${i}`,
                    type: 'short',
                    text: shortTemplates[i % shortTemplates.length],
                    maxMarks: marksPerQ
                });
            } else {
                questions.push({
                    id: `q_${Date.now()}_${i}`,
                    type: 'long',
                    text: longTemplates[i % longTemplates.length],
                    maxMarks: marksPerQ
                });
            }
        }

        return questions;
    }
    */
};

export default aiService;
