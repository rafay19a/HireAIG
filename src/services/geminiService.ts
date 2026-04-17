import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  jd?: string;
  skills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  skillMatchScore: number;
  semanticScore: number;
  finalScore: number;
  summary: string;
  resumeText: string;
  status?: string;
  report?: any;
}

export const geminiService = {
  async screenResumes(jd: string, resumes: { name: string; data: string; mimeType: string }[]): Promise<Candidate[]> {
    const prompt = `
      You are an expert AI Recruiter. 
      Analyze the following Job Description (JD) and the provided Resumes.
      
      JD: ${jd}
      
      For each resume:
      1. Extract candidate name, email, and phone.
      2. Extract all technical skills.
      3. Compare skills with JD requirements.
      4. Calculate Skill Match Score (matched_skills / jd_skills * 100).
      5. Calculate Semantic Match Score (0-100) based on overall experience and fit.
      6. Provide a brief summary of why they are or aren't a good fit.
      
      Return a JSON array of candidates.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: prompt },
        ...resumes.map(r => ({
          inlineData: {
            data: r.data,
            mimeType: r.mimeType
          }
        }))
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              matchedSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
              skillMatchScore: { type: Type.NUMBER },
              semanticScore: { type: Type.NUMBER },
              finalScore: { type: Type.NUMBER },
              summary: { type: Type.STRING },
              resumeText: { type: Type.STRING, description: "Full extracted text from resume" }
            },
            required: ["name", "email", "skills", "skillMatchScore", "semanticScore", "summary"]
          }
        }
      }
    });

    try {
      const candidates = JSON.parse(response.text || "[]");
      return candidates.map((c: any, i: number) => ({
        ...c,
        id: `cand-${i}-${Date.now()}`,
        finalScore: (c.skillMatchScore * 0.4 + c.semanticScore * 0.6).toFixed(1)
      }));
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return [];
    }
  },

  async generateInterviewReport(transcript: string, jd: string, resume: string): Promise<any> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        You are an expert HR Analyst. Based on the following interview transcript, Job Description (JD), and candidate resume, generate a comprehensive screening report.
        
        JD: ${jd}
        Resume: ${resume}
        Transcript: ${transcript}
        
        The report must include:
        1. Overall Knowledge Score (0-10)
        2. Confidence Score (0-10)
        3. Key Strengths
        4. Areas of Concern
        5. Timings & Availability Discussion Summary
        6. Motivation Summary
        7. Recommendation: Should the HR proceed to the main interview? (PROCEED / DO NOT PROCEED)
        
        Return the report in JSON format.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            knowledgeScore: { type: Type.NUMBER },
            confidenceScore: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            concerns: { type: Type.ARRAY, items: { type: Type.STRING } },
            timingsSummary: { type: Type.STRING },
            motivationSummary: { type: Type.STRING },
            recommendation: { type: Type.STRING, description: "PROCEED or DO NOT PROCEED" },
            reasoning: { type: Type.STRING }
          },
          required: ["knowledgeScore", "confidenceScore", "strengths", "concerns", "timingsSummary", "motivationSummary", "recommendation", "reasoning"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  },

  async evaluateAnswer(question: string, answer: string, jd: string): Promise<any> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Evaluate this interview answer based on the Job Description.
        JD: ${jd}
        Question: ${question}
        Answer: ${answer}
        
        Score 0-10 for:
        - Technical Quality
        - Relevance
        - Communication
        - Confidence
        
        Provide a summary and a verdict.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            technical: { type: Type.NUMBER },
            relevance: { type: Type.NUMBER },
            communication: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            verdict: { type: Type.STRING, description: "HIRE, MAYBE, or REJECT" }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  }
};
