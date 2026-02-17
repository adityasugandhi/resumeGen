/**
 * LLM Client - Supports multiple providers (Groq, Ollama)
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}

type LLMProvider = 'groq' | 'ollama';

/**
 * Get the configured LLM provider
 */
export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER?.toLowerCase();
  if (provider === 'ollama') return 'ollama';
  return 'groq'; // Default to Groq
}

/**
 * Call Ollama API
 */
async function callOllama(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3.2';

  // Ollama uses a different message format - combine system + user into prompt
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const userMessage = messages.find(m => m.role === 'user')?.content || '';

  const prompt = systemMessage
    ? `${systemMessage}\n\n${userMessage}`
    : userMessage;

  console.log(`[Ollama] Calling ${model} at ${baseUrl}...`);

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.3,
        num_predict: options.maxTokens ?? 8000,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  console.log(`[Ollama] Response received (${data.response?.length || 0} chars)`);

  return {
    content: data.response || '',
    model,
    provider: 'ollama',
  };
}

/**
 * Call Groq API
 */
async function callGroq(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const model = process.env.GROQ_OPTIMIZER_MODEL || 'llama-3.3-70b-versatile';

  console.log(`[Groq] Calling ${model}...`);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 8000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  console.log(`[Groq] Response received (${content.length} chars)`);

  return {
    content,
    model,
    provider: 'groq',
  };
}

/**
 * Main LLM call function - routes to appropriate provider
 */
export async function callLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const provider = getLLMProvider();

  console.log(`[LLM] Using provider: ${provider}`);

  switch (provider) {
    case 'ollama':
      return callOllama(messages, options);
    case 'groq':
    default:
      return callGroq(messages, options);
  }
}

/**
 * Check if LLM is available and configured
 */
export async function checkLLMStatus(): Promise<{
  available: boolean;
  provider: LLMProvider;
  model: string;
  error?: string;
}> {
  const provider = getLLMProvider();

  if (provider === 'ollama') {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3.2';

    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return {
          available: false,
          provider,
          model,
          error: `Ollama not responding at ${baseUrl}`,
        };
      }

      const data = await response.json();
      const models = data.models?.map((m: { name: string }) => m.name) || [];

      if (!models.some((m: string) => m.startsWith(model))) {
        return {
          available: false,
          provider,
          model,
          error: `Model ${model} not found. Available: ${models.join(', ')}. Run: ollama pull ${model}`,
        };
      }

      return { available: true, provider, model };
    } catch (error) {
      return {
        available: false,
        provider,
        model,
        error: `Cannot connect to Ollama at ${baseUrl}. Is it running? Run: ollama serve`,
      };
    }
  }

  // Groq
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_OPTIMIZER_MODEL || 'llama-3.3-70b-versatile';

  if (!apiKey) {
    return {
      available: false,
      provider,
      model,
      error: 'GROQ_API_KEY not configured in .env.local',
    };
  }

  return { available: true, provider, model };
}
