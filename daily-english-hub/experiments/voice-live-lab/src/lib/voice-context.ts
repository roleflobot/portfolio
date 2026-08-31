export type VoiceHint = {
  word: string;
  meaning: string;
};

export type VoiceQuizItem = {
  question: string;
  answer: boolean;
  explanation: string;
  hints: VoiceHint[];
};

export type VoiceBlankItem = {
  sentence: string;
  options: string[];
  answer: string;
  translation: string;
  hints: VoiceHint[];
};

export type VoiceLearningContext = {
  sessionId?: string;
  newsTitle: string;
  category?: string;
  summary: string[];
  translation: string[];
  vocabulary: VoiceHint[];
  quiz: VoiceQuizItem[];
  blanks: VoiceBlankItem[];
  writingWords: string[];
};

const text = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const textArray = (value: unknown, maxItems: number, maxLength: number) =>
  Array.isArray(value)
    ? value
        .slice(0, maxItems)
        .map((item) => text(item, maxLength))
        .filter(Boolean)
    : [];

const hints = (value: unknown, maxItems = 12): VoiceHint[] =>
  Array.isArray(value)
    ? value
        .slice(0, maxItems)
        .map((item) => {
          const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          return {
            word: text(record.word, 80),
            meaning: text(record.meaning, 160),
          };
        })
        .filter((item) => item.word)
    : [];

export function parseVoiceLearningContext(value: unknown): VoiceLearningContext | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const newsTitle = text(record.newsTitle, 500);
  const summary = textArray(record.summary, 8, 700);
  if (!newsTitle || summary.length === 0) return null;

  const quiz = Array.isArray(record.quiz)
    ? record.quiz.slice(0, 6).flatMap((item) => {
        const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const question = text(row.question, 700);
        if (!question || typeof row.answer !== "boolean") return [];
        return [
          {
            question,
            answer: row.answer,
            explanation: text(row.explanation, 700),
            hints: hints(row.hints, 10),
          },
        ];
      })
    : [];

  const blanks = Array.isArray(record.blanks)
    ? record.blanks.slice(0, 6).flatMap((item) => {
        const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const sentence = text(row.sentence, 700);
        const answer = text(row.answer, 100);
        if (!sentence || !answer) return [];
        return [
          {
            sentence,
            options: textArray(row.options, 6, 100),
            answer,
            translation: text(row.translation, 700),
            hints: hints(row.hints, 10),
          },
        ];
      })
    : [];

  return {
    sessionId: text(record.sessionId, 100) || undefined,
    newsTitle,
    category: text(record.category, 100) || undefined,
    summary,
    translation: textArray(record.translation, 8, 700),
    vocabulary: hints(record.vocabulary, 20),
    quiz,
    blanks,
    writingWords: textArray(record.writingWords, 12, 100),
  };
}

export const DEMO_CONTEXT: VoiceLearningContext = {
  newsTitle: "Cities expand cooling centers during a record heat wave",
  category: "Society",
  summary: [
    "Several cities opened additional cooling centers as temperatures reached record levels.",
    "Local officials asked residents to check on older neighbors and people living alone.",
    "Hospitals reported more patients with symptoms related to extreme heat.",
    "Some outdoor events were moved to the evening or canceled for safety.",
    "Weather experts said the heat could continue through the end of the week.",
  ],
  translation: [
    "여러 도시가 기온이 기록적인 수준에 도달하자 추가 무더위 쉼터를 열었습니다.",
    "지방 당국은 주민들에게 노인 이웃과 혼자 사는 사람들을 살펴달라고 요청했습니다.",
    "병원들은 극심한 더위와 관련된 증상을 보이는 환자가 늘었다고 보고했습니다.",
    "일부 야외 행사는 안전을 위해 저녁으로 옮겨지거나 취소되었습니다.",
    "기상 전문가들은 더위가 주말까지 계속될 수 있다고 말했습니다.",
  ],
  vocabulary: [
    { word: "expand", meaning: "확대하다" },
    { word: "resident", meaning: "주민" },
    { word: "symptom", meaning: "증상" },
    { word: "extreme", meaning: "극심한" },
    { word: "continue", meaning: "계속되다" },
  ],
  quiz: [
    {
      question: "Cities closed all cooling centers during the heat wave.",
      answer: false,
      explanation: "The cities opened additional cooling centers.",
      hints: [],
    },
    {
      question: "Officials encouraged residents to check on vulnerable neighbors.",
      answer: true,
      explanation: "Officials specifically mentioned older neighbors and people living alone.",
      hints: [{ word: "vulnerable", meaning: "취약한" }],
    },
  ],
  blanks: [
    {
      sentence: "Hospitals reported more patients with heat-related ______.",
      options: ["symptoms", "celebrations", "discounts", "journeys"],
      answer: "symptoms",
      translation: "병원들은 더위와 관련된 증상을 보이는 환자가 늘었다고 보고했습니다.",
      hints: [],
    },
    {
      sentence: "Experts said the heat could ______ through the week.",
      options: ["continue", "borrow", "divide", "hide"],
      answer: "continue",
      translation: "전문가들은 더위가 주중 내내 계속될 수 있다고 말했습니다.",
      hints: [],
    },
  ],
  writingWords: ["cities", "heat", "residents", "safety", "continue"],
};
