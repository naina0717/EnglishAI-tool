const GEMINI_API_KEY = 'AIzaSyC1U4B2azzXyJwfO6byo_UHTJlb3MVU2uw';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export interface AIFeedback {
  correct: boolean;
  score: number; // 0-100
  feedback: string;
}

export async function checkOpenAnswer(question: string, userAnswer: string, context?: string): Promise<AIFeedback> {
  try {
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 30000);
    });

    const prompt = `
You are an English teacher evaluating a student's answer. Please provide structured feedback.

Question: ${question}
${context ? `Context: ${context}` : ''}
Student's Answer: ${userAnswer}

Please evaluate the answer and respond in this exact JSON format:
{
  "correct": true/false,
  "score": number (0-100),
  "feedback": "detailed feedback explaining what's good and what could be improved"
}

Consider grammar, vocabulary, content relevance, and completeness in your evaluation.
`;

    const fetchPromise = fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    });
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid API response format');
    }
    
    const responseText = data.candidates[0].content.parts[0].text;
    
    // Try to parse JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
    }
    
    // Fallback response if JSON parsing fails
    return {
      correct: userAnswer.trim().length > 10,
      score: userAnswer.trim().length > 10 ? 75 : 25,
      feedback: responseText || 'Good effort! Keep practicing to improve your English skills.'
    };
    
  } catch (error) {
    console.error('Error checking answer with AI:', error);
    
    // Provide different fallback based on error type
    if (error instanceof Error && error.message === 'Request timeout') {
      return {
        correct: false,
        score: 0,
        feedback: 'The request timed out. Please check your internet connection and try again.'
      };
    }
    
    return {
      correct: false,
      score: 0,
      feedback: 'Unable to evaluate your answer at the moment. Please check your connection and try again.'
    };
  }
}

export async function checkSpeakingAnswer(prompt: string, transcript: string): Promise<AIFeedback> {
  try {
    const speakingPrompt = `
You are an English teacher evaluating a student's speaking response. Please provide structured feedback.

Speaking Prompt: ${prompt}
Student's Response: ${transcript}

Please evaluate the response and respond in this exact JSON format:
{
  "correct": true/false,
  "score": number (0-100),
  "feedback": "brief feedback under 100 words about pronunciation, fluency, and content"
}

Keep feedback encouraging and concise.
`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: speakingPrompt }] }]
      })
    });
    
    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    // Try to parse JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        // Ensure feedback is concise
        if (result.feedback.length > 100) {
          result.feedback = result.feedback.substring(0, 97) + '...';
        }
        return result;
      }
    } catch (parseError) {
      console.error('Error parsing speaking response:', parseError);
    }
    
    // Fallback
    return {
      correct: transcript.length > 5,
      score: transcript.length > 5 ? 75 : 25,
      feedback: 'Good effort! Keep practicing your speaking skills.'
    };
    
  } catch (error) {
    console.error('Error checking speaking answer:', error);
    return {
      correct: false,
      score: 0,
      feedback: 'Unable to evaluate. Please try again.'
    };
  }
}

export async function checkWritingAnswer(prompt: string, essay: string, minWords?: number): Promise<AIFeedback> {
  const wordCount = essay.trim().split(/\s+/).length;
  const context = `This is a writing exercise. ${minWords ? `Minimum words required: ${minWords}. ` : ''}Word count: ${wordCount}. Evaluate grammar, vocabulary, structure, and content.`;
  
  return checkOpenAnswer(prompt, essay, context);
}