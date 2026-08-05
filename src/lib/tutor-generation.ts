export const OPENAI_TUTOR_MODEL = "gpt-5.6";
export const MAX_TUTOR_MESSAGE_LENGTH = 2_000;

export type TutorGenerationMode = "openai" | "mock";

export type TutorSourcePassage = {
  id: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  heading: string | null;
  content: string;
};

export type TutorCitation = {
  sourceChunkId: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  heading: string | null;
  excerpt: string;
};

export type TutorReply = {
  content: string;
  grounding: "course_material" | "general_knowledge";
  citations: TutorCitation[];
};

export type TutorGenerationInput = {
  question: string;
  passages: TutorSourcePassage[];
  hasPriorAssistantReply: boolean;
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type OpenAiTutorClient = {
  responses: {
    create: (input: {
      model: string;
      input: Array<{ role: "system" | "user"; content: string }>;
      text: {
        format: {
          type: "json_schema";
          name: string;
          strict: true;
          schema: typeof tutorStructuredOutputSchema;
        };
      };
    }) => Promise<{ output_text: string }>;
  };
};

export class TutorGenerationError extends Error {
  constructor(message = "The tutor could not prepare a response. Please try again.") {
    super(message);
    this.name = "TutorGenerationError";
  }
}

function cleanText(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximumLength) : "";
}

function sourceCitation(passage: TutorSourcePassage): TutorCitation {
  return {
    sourceChunkId: passage.id,
    documentId: passage.documentId,
    documentTitle: passage.documentTitle,
    pageNumber: passage.pageNumber,
    heading: passage.heading,
    excerpt: cleanText(passage.content, 480),
  };
}

function sourceSentence(passage: TutorSourcePassage) {
  const cleaned = cleanText(passage.content, 700);
  const sentence = cleaned.match(/^.*?[.!?](?:\s|$)/)?.[0];
  return cleanText(sentence ?? cleaned, 420);
}

function sourceLocation(passage: TutorSourcePassage) {
  return [
    passage.documentTitle,
    passage.pageNumber === null ? null : `Page ${passage.pageNumber}`,
    passage.heading,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function generalKnowledgeLabel(content: string) {
  const prefix = "General-knowledge response (not supported by the selected material):";
  return content.startsWith(prefix) ? content : `${prefix} ${content}`;
}

export function resolveTutorGenerationMode(
  configuredMode: string | undefined,
  environment: string | undefined,
): TutorGenerationMode {
  if (!configuredMode && environment === "development") return "mock";
  if (!configuredMode || configuredMode === "openai") return "openai";
  if (configuredMode === "mock" && environment === "development") return "mock";
  if (configuredMode === "mock") {
    throw new TutorGenerationError("Mock tutor generation is available only during local development.");
  }
  throw new TutorGenerationError("AI_TUTOR_MODE must be omitted, openai, or mock for local development.");
}

function validateInput(input: TutorGenerationInput) {
  const question = cleanText(input?.question, MAX_TUTOR_MESSAGE_LENGTH);
  if (!question) throw new TutorGenerationError("Write a question or an idea you want to work through.");
  const passages = Array.isArray(input?.passages)
    ? input.passages.filter(
        (passage) =>
          passage &&
          typeof passage.id === "string" &&
          typeof passage.documentId === "string" &&
          Boolean(cleanText(passage.documentTitle, 255)) &&
          Boolean(cleanText(passage.content, 2_000)),
      )
    : [];
  return { question, passages, hasPriorAssistantReply: input.hasPriorAssistantReply };
}

/**
 * Deterministic local response for development. Its first turn deliberately
 * asks the learner to reason from a relevant source before revealing a concise
 * explanation on a later tutor turn.
 */
export function createMockTutorReply(input: TutorGenerationInput): TutorReply {
  const validated = validateInput(input);
  const passage = validated.passages[0];

  if (!passage) {
    return {
      grounding: "general_knowledge",
      citations: [],
      content: generalKnowledgeLabel(
        "I could not find a matching passage in the materials selected for this conversation. " +
          "Try stating what you already know about the idea, then identify one part that feels uncertain.",
      ),
    };
  }

  const location = sourceLocation(passage);
  if (!validated.hasPriorAssistantReply) {
    return {
      grounding: "course_material",
      citations: [sourceCitation(passage)],
      content:
        `I found a relevant passage in ${location}. Before I explain it, what do you think that section suggests about your question? ` +
        "Try naming the main idea and one detail that supports it.",
    };
  }

  const statement = sourceSentence(passage);
  return {
    grounding: "course_material",
    citations: [sourceCitation(passage)],
    content:
      `A concise explanation from ${location}: ${statement} ` +
      "Now, in your own words, how does that detail answer the question you are working on?",
  };
}

function mapCitationIndexes(indexes: unknown, passages: TutorSourcePassage[]) {
  if (!Array.isArray(indexes)) throw new TutorGenerationError();
  const uniqueIndexes = [...new Set(indexes)];
  if (
    uniqueIndexes.length > 3 ||
    uniqueIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= passages.length)
  ) {
    throw new TutorGenerationError();
  }
  return uniqueIndexes.map((index) => sourceCitation(passages[index]));
}

/**
 * Parses an OpenAI structured response without accepting model-created source
 * metadata. The model can select only an index from the server-retrieved list.
 */
export function parseOpenAiTutorOutput(output: string, passages: TutorSourcePassage[]): TutorReply {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new TutorGenerationError();
  }
  if (!parsed || typeof parsed !== "object") throw new TutorGenerationError();
  const value = parsed as Record<string, unknown>;
  const content = cleanText(value.reply, 4_000);
  const grounding = value.grounding;
  if (!content || (grounding !== "course_material" && grounding !== "general_knowledge")) {
    throw new TutorGenerationError();
  }
  const citations = mapCitationIndexes(value.citation_indexes, passages);
  if (grounding === "course_material" && citations.length === 0) throw new TutorGenerationError();
  if (grounding === "general_knowledge" && citations.length > 0) throw new TutorGenerationError();
  return {
    content: grounding === "general_knowledge" ? generalKnowledgeLabel(content) : content,
    grounding,
    citations,
  };
}

export const tutorStructuredOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "grounding", "citation_indexes"],
  properties: {
    reply: { type: "string" },
    grounding: { type: "string", enum: ["course_material", "general_knowledge"] },
    citation_indexes: { type: "array", items: { type: "integer" }, maxItems: 3 },
  },
} as const;

function sourceBlock(passages: TutorSourcePassage[]) {
  return passages
    .map((passage, index) =>
      `[${index}] ${sourceLocation(passage)}\n${cleanText(passage.content, 1_500)}`,
    )
    .join("\n\n");
}

export function buildOpenAiTutorPrompt(input: TutorGenerationInput) {
  const validated = validateInput(input);
  const history = (input.recentMessages ?? [])
    .slice(-6)
    .map((message) => `${message.role === "assistant" ? "Tutor" : "Learner"}: ${cleanText(message.content, 1_200)}`)
    .join("\n");

  return {
    system:
      "You are a guidance-first study tutor. Help the learner reason before revealing a full answer. " +
      "On an early turn, give a focused hint and ask a check-for-understanding question. " +
      "After the learner has attempted an answer or explicitly asks for an explanation, give a concise explanation and another reflection question. " +
      "Use course_material only when the retrieved passages directly support the reply, and select only their citation indexes. " +
      "Use general_knowledge with an empty citation_indexes when no passage supports the reply; state that limitation in the reply. Never invent citations or source facts.",
    user:
      `Learner question: ${validated.question}\n\nEarlier conversation:\n${history || "(none)"}\n\nRetrieved passages:\n${sourceBlock(validated.passages) || "(none)"}`,
  };
}

/** OpenAI-ready path; mock mode is used until API credits are enabled. */
export async function generateOpenAiTutorReply(
  client: OpenAiTutorClient,
  input: TutorGenerationInput,
  model = OPENAI_TUTOR_MODEL,
) {
  const prompt = buildOpenAiTutorPrompt(input);
  const response = await client.responses.create({
    model,
    input: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    text: { format: { type: "json_schema", name: "tutor_reply", strict: true, schema: tutorStructuredOutputSchema } },
  });
  return parseOpenAiTutorOutput(response.output_text, input.passages);
}
