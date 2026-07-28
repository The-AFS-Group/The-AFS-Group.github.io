import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CallData } from "../types";

// Lazy initialization of Gemini Client
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export interface StrategicInsight {
  title: string;
  content: string;
  category: "trend" | "confusion" | "price" | "persona" | "ops" | "market" | "offer" | "enablement";
}

const insightSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    insights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Title of the strategic insight (e.g., 'Emerging Trend')" },
          content: { type: Type.STRING, description: "The insight summary. Use markdown **bold** for key terms." },
          category: { 
            type: Type.STRING, 
            enum: ["trend", "confusion", "price", "persona", "ops", "market", "offer", "enablement"],
            description: "Category of the insight matching the 8 requested areas."
          }
        },
        required: ["title", "content", "category"],
      },
    },
  },
  required: ["insights"],
};

export const generateStrategicInsights = async (calls: CallData[]): Promise<StrategicInsight[]> => {
  try {
    const client = getAiClient();
    
    // Optimize token usage: Select only relevant fields and limit count
    const sample = calls.slice(0, 40).map(c => ({
      job: c.job_functional,
      barrier: c.barrier_primary,
      motivation: c.motivation_primary,
      products: c.products_mentioned_specific,
      sentiment: c.sentiment_label,
      segment: c.customer_segment,
      gaps: c.missing_information_critical
    }));

    const prompt = `
      Analyze the following recent customer call data (last 7 days) for a Gym & Fitness equipment retailer.
      
      Generate 8 specific strategic insights in the following categories:
      1. Emerging Demand Trend (New patterns in product interest)
      2. Customer Confusion (Technical specs or process gaps)
      3. Price & Value Perception (Sensitivity, budget issues)
      4. Persona Themes (Who is buying and why)
      5. Operational Friction (Shipping, stock, lead times)
      6. Market Shifts (Competitor mentions, comparison shopping)
      7. Micro-Offer Idea (A testable offer to close more deals)
      8. Sales Enablement (Training gap or script improvement)
  
      Input Data:
      ${JSON.stringify(sample)}
    `;

    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview", // Updated model
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: insightSchema,
        temperature: 0.2, // Low temperature for analytical consistency
      },
    });

    const jsonText = response.text;
    if (!jsonText) return [];

    const result = JSON.parse(jsonText);
    return result.insights || [];

  } catch (error) {
    console.error("Gemini AI Analysis Failed:", error);
    return [];
  }
};