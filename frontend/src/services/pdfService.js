import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker to use the CDN matching the exact version installed
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const pdfService = {
    /**
     * Reads a PDF File object and extracts all text from it.
     */
    async extractText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    const typedArray = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
                    let fullText = '';
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        // Join items with a space, but also add a small newline for disparate blocks
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n\n';
                    }
                    resolve(fullText);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Attempts to parse raw extracted text into an array of MCQ question objects.
     * Uses regex to look for patterns like "1. Question", "A) Option", etc.
     */
    parseQuestions(rawText, maxMarks = 50) {
        const questions = [];
        
        // Split text by numbers followed by a dot or parenthesis (e.g., "1. ", "2. ", "1)", "2)")
        const chunks = rawText.split(/(?=\b\d+[.)]\s)/g);
        
        let qIndex = 0;
        for (const chunk of chunks) {
            // Match the question text before the first option (a., b., or A), B))
            const match = chunk.match(/^\d+[.)]\s+(.*?)(?=\b[a-d][.)]|$)/is);
            if (match) {
                const qText = match[1].trim();
                
                // Find options (a., b., c., d. or a), b), c), d) - case insensitive)
                const options = [];
                const optRegex = /\b([a-d])[.)]\s*(.*?)(?=\b[a-d][.)]|$)/gi;
                let optMatch;
                while ((optMatch = optRegex.exec(chunk)) !== null) {
                    // Remove any trailing Answer: ... from the last option if it got tangled
                    let optText = optMatch[2].trim();
                    const ansIndex = optText.toLowerCase().indexOf('answer:');
                    if (ansIndex !== -1) {
                        optText = optText.substring(0, ansIndex).trim();
                    }
                    if (optText) {
                        options.push(optText);
                    }
                }

                // Try to find the answer (e.g., "Answer: B" or "Ans: c")
                let correctAns = options.length > 0 ? options[0] : "Option A"; // Default
                const ansMatch = chunk.match(/\b(?:ans|answer)\s*:\s*([a-d])/i);
                if (ansMatch && options.length > 0) {
                    const ansLetter = ansMatch[1].toLowerCase();
                    const indexMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
                    const foundIndex = indexMap[ansLetter];
                    if (foundIndex !== undefined && options[foundIndex]) {
                        correctAns = options[foundIndex];
                    }
                }

                // If we found a question and at least 2 options, save it
                if (qText && options.length >= 2) {
                    // Ensure we have at least 4 options, padded if necessary
                    while (options.length < 4) {
                        options.push(`Option ${String.fromCharCode(65 + options.length)}`);
                    }

                    questions.push({
                        id: `q_local_${Date.now()}_${qIndex++}`,
                        type: 'mcq',
                        text: qText,
                        options: options.slice(0, 4),
                        correct: correctAns,
                        maxMarks: 5 
                    });
                }
            }
        }

        // Adjust marks if we extracted valid questions
        if (questions.length > 0) {
            const marksPerQ = Math.round(maxMarks / questions.length);
            questions.forEach(q => q.maxMarks = marksPerQ);
        }

        return questions;
    }
};

export default pdfService;
