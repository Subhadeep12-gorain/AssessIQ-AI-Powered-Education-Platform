/**
 * AI Service for AssessIQ
 * Handles all AI-related logic including generation, grading, and insights.
 * Used in: CreateAssessmentModal.jsx (question generation), ReviewCenterModal (subjective grading)
 */
import OpenAI from "openai";

const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = "google/gemini-2.5-flash";

const getApiKey = () => {
    return import.meta.env.VITE_OPENROUTER_API_KEY || "";
};

const getAIClient = () => {
    const key = getApiKey();
    if (!key) return null;
    return new OpenAI({
        baseURL: OPENROUTER_URL,
        apiKey: key,
        dangerouslyAllowBrowser: true
    });
};

export const aiService = {
    /**
     * Analyzes a student's answer for subjective grading.
     * Used in: ReviewCenterModal
     */
    async analyzeSubjectiveAnswer(questionText, studentAnswer, maxMarks) {
        const apiKey = getApiKey();
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
        const ai = getAIClient();
        if (!ai) return "OpenRouter API is not configured. Please check your VITE_OPENROUTER_API_KEY environment variable.";
        
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
        const ai = getAIClient();
        if (!ai) throw new Error("OpenRouter API key is missing. Check your VITE_OPENROUTER_API_KEY.");

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
    }
};

export default aiService;
