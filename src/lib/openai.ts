import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not set; ingredient extraction will fail.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});
