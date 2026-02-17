import Groq from 'groq-sdk';
import { z } from 'zod';

// Zod schema for structured LinkedIn note response
export const LinkedInNoteSchema = z.object({
  note: z.string().describe('Primary connection note under 300 characters'),
  variations: z.array(z.string()).describe('2-3 alternative versions'),
  charCount: z.number().describe('Character count of primary note'),
});

export type LinkedInNoteResult = z.infer<typeof LinkedInNoteSchema>;

export interface LinkedInNoteParams {
  personName: string;
  personRole?: string;
  personCompany?: string;
  jobTitle: string;
  jobCompany: string;
  jobRequirements?: string[];
  userBackground?: string;
}

export class LinkedInNoteGenerator {
  private client: Groq;

  constructor(apiKey?: string) {
    this.client = new Groq({
      apiKey: apiKey || process.env.GROQ_API_KEY,
    });
  }

  /**
   * Extract JSON from AI response using multiple strategies
   */
  private extractJson(response: string): Record<string, unknown> | null {
    const text = response.trim();

    // Strategy 1: Try to parse the entire response as JSON
    try {
      return JSON.parse(text);
    } catch {
      // Continue to other strategies
    }

    // Strategy 2: Extract JSON from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // Continue to other strategies
      }
    }

    // Strategy 3: Find the first complete JSON object using brace matching
    const startIndex = text.indexOf('{');
    if (startIndex !== -1) {
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\' && inString) {
          escapeNext = true;
          continue;
        }

        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;

          if (braceCount === 0) {
            const jsonStr = text.substring(startIndex, i + 1);
            try {
              return JSON.parse(jsonStr);
            } catch {
              break;
            }
          }
        }
      }
    }

    // Strategy 4: Simple regex extraction (fallback)
    const simpleMatch = text.match(/\{[\s\S]*\}/);
    if (simpleMatch) {
      try {
        return JSON.parse(simpleMatch[0]);
      } catch {
        // All strategies failed
      }
    }

    return null;
  }

  /**
   * Generate a personalized LinkedIn connection note
   */
  async generateConnectionNote(params: LinkedInNoteParams): Promise<LinkedInNoteResult> {
    const {
      personName,
      personRole,
      personCompany,
      jobTitle,
      jobCompany,
      jobRequirements,
      userBackground,
    } = params;

    const prompt = `You are an expert at writing personalized LinkedIn connection notes that get accepted. Generate a professional, warm connection request note.

CONTEXT:
- Person to connect with: ${personName}
${personRole ? `- Their role: ${personRole}` : ''}
${personCompany ? `- Their company: ${personCompany}` : `- Company: ${jobCompany}`}
- Target job: ${jobTitle} at ${jobCompany}
${jobRequirements && jobRequirements.length > 0 ? `- Key job requirements: ${jobRequirements.slice(0, 5).join(', ')}` : ''}
${userBackground ? `- Your background: ${userBackground}` : ''}

REQUIREMENTS:
1. MUST be under 300 characters (LinkedIn limit)
2. Open with "Hi ${personName.split(' ')[0]}" (use first name only)
3. Mention the specific role or company naturally
4. Show genuine interest - not generic or salesy
5. Include a subtle ask or connection reason
6. Be warm but professional
7. NO emojis
8. Do NOT start with "I noticed" or "I saw" - be more creative

EXAMPLES OF GOOD NOTES:
- "Hi Sarah, I'm exploring the Product Manager role at Stripe—your experience scaling the payments team would be invaluable insight. Would love to connect!"
- "Hi John, pursuing Delta's AI Engineer position. Your SAFe expertise aligns with what I'm building. Would appreciate connecting to learn more about the team."

Return ONLY valid JSON (no markdown):
{
  "note": "The primary connection note under 300 chars",
  "variations": ["Alternative 1 under 300 chars", "Alternative 2 under 300 chars"],
  "charCount": 285
}`;

    const response = await this.client.chat.completions.create({
      model: process.env.GROQ_OPTIMIZER_MODEL || 'llama-3.3-70b-versatile',
      max_tokens: 512,
      messages: [
        {
          role: 'system',
          content: 'You are a networking expert who writes compelling LinkedIn connection notes. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7, // Higher temperature for creative, varied notes
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No text response from Groq');
    }

    // Extract JSON from response
    const jsonData = this.extractJson(responseContent);
    if (!jsonData) {
      console.error('[linkedin-note] Failed to extract JSON from response:', responseContent.substring(0, 200));
      throw new Error('Could not extract valid JSON from AI response');
    }

    // Validate with Zod
    const result = LinkedInNoteSchema.parse(jsonData);

    // Ensure notes are under 300 characters (truncate if needed)
    const ensureLength = (text: string): string => {
      if (text.length <= 300) return text;
      // Find last complete word before 297 chars, add "..."
      const truncated = text.substring(0, 297);
      const lastSpace = truncated.lastIndexOf(' ');
      return truncated.substring(0, lastSpace) + '...';
    };

    return {
      note: ensureLength(result.note),
      variations: result.variations.map(ensureLength),
      charCount: ensureLength(result.note).length,
    };
  }
}
