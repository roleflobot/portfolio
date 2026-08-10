import type { AiContent } from "./supabase/types";
import type { NaverArticle, NewsHeadline } from "./news";

async function callGemini(
  systemPrompt: string,
  userText: string,
  responseSchema: object
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API 키가 설정되지 않았습니다. .env.local에 GEMINI_API_KEY를 채워주세요."
    );
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini 호출 실패 (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const rawText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Gemini 응답에서 텍스트를 찾을 수 없습니다.");
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error("Gemini 응답이 유효한 JSON이 아닙니다.");
  }
}

// ── 주제 선정 (Google News 헤드라인 묶음 → 서로 다른 주요 주제 5개) ──

export const TOPIC_CATEGORIES = ["정치", "국제", "사회", "경제", "과학기술", "문화"] as const;
export type TopicCategory = (typeof TOPIC_CATEGORIES)[number];

export type TopicCandidate = {
  topic: string;
  searchQuery: string;
  representativeTitle: string;
  category: TopicCategory;
  url: string | null;
  /** 새벽 3시 배치에서 미리 생성해둔 학습자료. 있으면 클릭 시 즉시 사용한다. */
  aiContent?: AiContent;
  newsDescription?: string | null;
};

const TOPIC_SCHEMA = {
  type: "array",
  minItems: 5,
  maxItems: 5,
  items: {
    type: "object",
    properties: {
      topic: { type: "string" },
      search_query: { type: "string" },
      representative_title: { type: "string" },
      category: { type: "string", enum: [...TOPIC_CATEGORIES] },
      source_index: { type: "integer" },
    },
    required: [
      "topic",
      "search_query",
      "representative_title",
      "category",
      "source_index",
    ],
  },
};

const TOPIC_SYSTEM_PROMPT = `당신은 오늘의 Google 뉴스 주요 기사 제목들을 보고, 영어 학습자가 관심에 따라 선택할 수 있도록
서로 구별되는 주요 뉴스 주제 5개를 선정하는 편집자입니다.

입력은 오늘 Google 뉴스 주요 기사 제목 목록이며, 각 항목에는 idx와 title이 있습니다.

## 작업
1. 같은 사건을 다룬 여러 기사가 있으면 하나의 주제로 묶으세요(언론사만 다르고 사실상 같은 기사인 경우 포함).
   단, 오늘 이 목록 안에서 같은 사건이 여러 카드를 차지하지 않도록만 하면 됩니다.
2. 최근 며칠 동안 계속 보도된 사건이라는 이유만으로 제외하지 마세요. 진행 중인 사건의 새로운 상황이나
   후속 보도(예: 협상 진전, 시장 반응 등)도 좋은 학습 주제입니다. 오늘 배치 안에서의 중복만 피하면 됩니다.
   다만 입력에 "최근 학습한 주제" 목록이 함께 주어지면, 그 목록과 사실상 동일한 내용(새로운 전개나
   추가 정보 없이 같은 사실을 반복하는 경우)은 다시 선정하지 마세요. 같은 사건이라도 새로운 진전이
   있다면 선정해도 됩니다.
3. 정치, 경제, 국제, 사회, 과학기술, 문화 등 가능한 한 서로 다른 내용을 선택해 학습자에게 선택권을 주세요.
   다만 이는 참고 기준일 뿐 강제 규칙은 아닙니다 — 오늘 특정 주제의 기사가 유난히 많다면 그 분포를
   억지로 무시하지 않아도 됩니다.

## 각 주제마다 반환할 값
- topic: 주제를 나타내는 한국어 짧은 제목(예: "미 연준 금리 전망")
- search_query: 이 주제로 NAVER 뉴스를 검색할 때 사용할 한국어 검색어(2~4 단어, 고유명사 위주)
- representative_title: 이 주제를 대표하는 입력 목록의 title 값을 그대로 복사
- category: 정치, 국제, 사회, 경제, 과학기술, 문화 중 이 주제에 가장 가까운 하나
- source_index: representative_title에 해당하는 입력 항목의 idx (정수)

## 출력 규칙
- 반드시 지정된 JSON 스키마(길이 5의 배열)로만 출력하세요.
- JSON 이외의 설명, 인사말, 마크다운 코드블록을 출력하지 마세요.`;

export async function selectTopTopics(
  headlines: NewsHeadline[],
  recentTopics: string[] = []
): Promise<TopicCandidate[]> {
  const recentText =
    recentTopics.length > 0
      ? `\n\n최근 학습한 주제 목록(참고용, 완전히 동일한 내용은 피하되 후속 소식은 허용):\n${recentTopics
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  const userText = `오늘의 Google 뉴스 주요 기사 제목 목록:\n${JSON.stringify(
    headlines.map((h, idx) => ({ idx, title: h.title })),
    null,
    2
  )}${recentText}\n\n위 목록에서 서로 다른 주요 주제 5개를 선정하세요.`;

  const parsed = await callGemini(TOPIC_SYSTEM_PROMPT, userText, TOPIC_SCHEMA);

  if (!Array.isArray(parsed) || parsed.length !== 5) {
    throw new Error("Gemini 주제 선정 응답 구조가 예상과 다릅니다.");
  }

  return parsed.map((item) => {
    const record = item as {
      topic?: unknown;
      search_query?: unknown;
      representative_title?: unknown;
      category?: unknown;
      source_index?: unknown;
    };

    const sourceIndex =
      typeof record.source_index === "number" ? record.source_index : -1;
    const matched = headlines[sourceIndex];
    const category = TOPIC_CATEGORIES.includes(record.category as TopicCategory)
      ? (record.category as TopicCategory)
      : "사회";

    return {
      topic: String(record.topic ?? "").trim(),
      searchQuery: String(record.search_query ?? "").trim(),
      representativeTitle:
        String(record.representative_title ?? matched?.title ?? "").trim(),
      category,
      url: matched?.url ?? null,
    };
  });
}

// ── 학습자료 생성 (선택된 주제 → 영어 요약/번역/어휘/퀴즈) ──
//
// 하나의 Gemini 호출로 summary/vocabulary/quiz/blanks/writingWords를 전부 만들면,
// 배치 도중 중단됐을 때 다 만든 것까지 잃는다. 그래서 3단계로 나눠 호출하고,
// 각 단계가 끝날 때마다 topics-service.ts가 그 결과를 즉시 캐시에 저장한다.
//   1) article core (summary/translation/vocabulary/writingWords) — 반드시 먼저 만들어짐
//   2) quiz — article core의 summary만 있으면 독립적으로 만들 수 있음
//   3) blanks — article core의 summary/vocabulary만 있으면 독립적으로 만들 수 있음
// 2)와 3)은 서로에게 의존하지 않아 병렬로 만들 수 있고, 오디오(TTS)도 1)만 끝나면
// 2)·3)을 기다리지 않고 바로 만들 수 있다.

export type ArticleCore = Pick<AiContent, "summary" | "translation" | "vocabulary" | "writingWords">;

const toHints = (value: unknown) =>
  Array.isArray(value)
    ? value.map((h) => ({
        word: String((h as { word?: unknown })?.word ?? ""),
        meaning: String((h as { meaning?: unknown })?.meaning ?? ""),
      }))
    : [];

const HINT_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      word: { type: "string" },
      meaning: { type: "string" },
    },
    required: ["word", "meaning"],
  },
};

// ── 1단계: article core ──

const ARTICLE_CORE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
    translation: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
    vocabulary: {
      type: "array",
      minItems: 10,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          meaning: { type: "string" },
          pos: { type: "string", enum: ["verb", "noun", "adjective", "adverb"] },
        },
        required: ["word", "meaning", "pos"],
      },
    },
    writingWords: { type: "array", items: { type: "string" }, minItems: 7, maxItems: 7 },
  },
  required: ["summary", "translation", "vocabulary", "writingWords"],
};

const ARTICLE_CORE_SYSTEM_PROMPT = `당신은 한국의 최신 뉴스를 CEFR A2~B1 수준의 영어 학습 자료로 재구성하는 영어교육 전문가입니다.

입력된 뉴스 제목과 검색 결과(title/description)만 사실 근거로 사용하세요.

## 정보 근거 원칙
- 입력 자료에 명확히 나타난 사실만 사용하세요.
- 입력에 없는 배경, 원인, 결과, 전망을 추측해서 추가하지 마세요.
- 서로 충돌하거나 불확실한 정보는 제외하세요.
- 인명, 지명, 기관명, 숫자와 날짜는 입력에서 확인되는 경우에만 사용하세요.
- 검색 결과에는 선택된 뉴스 주제와 무관한 기사가 섞여 있을 수 있습니다. 주제와 직접 관련된
  기사만 사실 근거로 사용하고, 무관한 기사의 내용은 무시하세요.
- 서로 다른 기사에 나온 별개의 사건이나 행동을 하나의 사실로 임의 결합하지 마세요.

## summary / translation
- summary는 영어 문장 정확히 5개. 각 문장은 CEFR B1~B2 수준으로, 12~20 단어이며 접속사나 분사구문 등을
  섞어 A2 수준보다 문장 구조를 다양하게 구성한다. 다만 하나의 문장에는 하나의 핵심 사실만 담아
  정보가 뒤섞이지 않게 한다.
- translation은 summary와 같은 순서, 같은 개수(5개)의 한국어 번역이며 원문에 없는 내용을 추가하지 않는다.

## vocabulary
- summary 5문장에서 실제로 쓰인 어휘 중 정확히 10개. word는 영어 단어, meaning은 한국어 뜻(품사·예문·번호 없이 뜻만).
- 너무 쉬운 단어(예: go, big, said)보다 학습 가치가 있는 어휘(예: alliance, announce, decline)를 우선한다.
  10개를 채우려면 가장 핵심적인 5~6개 외에, 그다음으로 학습 가치가 있는 어휘까지 폭넓게 포함한다.
- 같은 단어를 중복해서 넣지 않는다.
- 어휘가 동사라면, summary 문장 안에서 과거형·현재분사형 등으로 활용되어 있어도 word에는
  반드시 사전 표제어 형태인 동사원형을 적는다(예: 문장에 "announced"가 쓰였어도 word는 "announce").
- 그 동사가 불규칙 변화 동사라면, meaning 뒤에 " (-과거형-과거분사형)" 형식으로 덧붙인다.
  규칙 변화 동사(-ed만 붙이면 되는 경우)에는 이 표기를 절대 붙이지 않는다.
  예) word: "approach", meaning: "접근하다" → 규칙 변화이므로 추가 표기 없음
  예) word: "ride", meaning: "타다 (-rode-ridden)" → 불규칙 변화이므로 과거형·과거분사형 표기
- pos에는 그 단어의 품사를 "verb"/"noun"/"adjective"/"adverb" 중 하나로 정확히 표시한다.
  이 값은 복습 퀴즈에서 오답 보기의 품사를 정답과 맞추는 데 쓰이므로 정확해야 한다.

## writingWords
- summary가 다루는 핵심 내용을 나타내는 단어 정확히 7개. 학습자가 이 7개 단어를 전부 써서
  직접 이 뉴스의 요약문을 영어로 작성하는 활동에 쓰인다.
- 뉴스에는 인명·지명·기관명 같은 고유명사가 많아 그것만으로 7개를 채우면 학습자가 정작
  자기 어휘력·문장력을 보여줄 여지가 없다. 고유명사는 요약문을 자연스럽게 쓰는 데 꼭
  필요한 것만 2~3개로 제한하고, 나머지 4~5개는 vocabulary에 준하는 일반 동사·명사·형용사로
  채운다(예: decide, increase, request 같은 실제 내용어).
- vocabulary 목록과 겹쳐도 되지만, summary의 핵심 사실(누가, 무엇을, 어떻게)을 표현하는 데
  실제로 필요한 단어로 고른다 — 이 7개만으로 요약 문장을 자연스럽게 만들 수 있을 정도로
  핵심적이어야 한다.
- 동사는 원형(사전형)으로 적는다.

## 출력 규칙
- 반드시 지정된 JSON 스키마 구조로만 출력하세요.
- JSON 이외의 설명, 인사말, 마크다운 코드블록을 출력하지 마세요.`;

export async function generateArticleCore(
  newsTitle: string,
  articles: NaverArticle[]
): Promise<ArticleCore> {
  const userText = `선택된 뉴스 주제:\n${newsTitle}\n\n뉴스 검색 결과(title/description):\n${JSON.stringify(
    articles,
    null,
    2
  )}\n\n위 자료를 근거로 영어 학습 자료를 생성하세요.`;

  const parsed = await callGemini(ARTICLE_CORE_SYSTEM_PROMPT, userText, ARTICLE_CORE_SCHEMA);
  return validateArticleCore(parsed);
}

function validateArticleCore(value: unknown): ArticleCore {
  const v = value as Partial<ArticleCore> | null;

  if (
    !v ||
    !Array.isArray(v.summary) ||
    v.summary.length !== 5 ||
    !Array.isArray(v.translation) ||
    v.translation.length !== 5 ||
    !Array.isArray(v.vocabulary) ||
    v.vocabulary.length !== 10
  ) {
    throw new Error("Gemini 응답 구조(article core)가 예상과 다릅니다.");
  }

  const VALID_POS = ["verb", "noun", "adjective", "adverb"] as const;
  const vocabulary = v.vocabulary.map((item) => {
    const pos = String((item as { pos?: unknown })?.pos ?? "");
    return {
      word: String(item?.word ?? ""),
      meaning: String(item?.meaning ?? ""),
      pos: (VALID_POS as readonly string[]).includes(pos)
        ? (pos as (typeof VALID_POS)[number])
        : "noun",
    };
  });

  const writingWords = Array.isArray(v.writingWords)
    ? v.writingWords.slice(0, 7).map((w) => String(w))
    : [];

  return {
    summary: v.summary.map((s) => String(s)),
    translation: v.translation.map((s) => String(s)),
    vocabulary,
    writingWords,
  };
}

// ── 2단계: quiz (summary만 있으면 독립적으로 생성 가능) ──

const QUIZ_SCHEMA = {
  type: "array",
  minItems: 3,
  maxItems: 3,
  items: {
    type: "object",
    properties: {
      question: { type: "string" },
      answer: { type: "boolean" },
      explanation: { type: "string" },
      hints: HINT_SCHEMA,
    },
    required: ["question", "answer", "explanation", "hints"],
  },
};

const QUIZ_SYSTEM_PROMPT = `당신은 영어 뉴스 요약문을 바탕으로 이해도를 확인하는 True/False 문제를 만드는 영어교육 전문가입니다.

입력으로 학습자에게 이미 보여준 영어 요약 문장 5개(summary)가 주어집니다. 이 문장들에 명확히
나타난 사실만 근거로 사용하세요 — summary에 없는 배경, 원인, 결과, 외부 지식을 추측해서
새로 만들지 마세요.

## 중요 지침 — summary 문장을 그대로 재사용하지 않는다
question은 summary에 있는 문장을 한두 단어만 바꿔서 쓰면 안 됩니다. 같은 사실을 다른 어순·
다른 문장 구조·동의어로 다시 쓴(paraphrase) 새로운 문장이어야 합니다. summary 문장과 겹치는
5단어 이상의 연속된 구절이 있으면 안 됩니다. 목적은 학습자가 원문을 암기해서 맞히는 게 아니라
내용을 실제로 이해했는지 확인하는 것입니다. paraphrase한 문장도 summary와 같은 CEFR B1~B2
난이도를 유지해야 합니다 — 단순한 단어나 짧은 구조로 쉽게 낮춰 쓰지 마세요.

paraphrase를 위해 summary에 없던 새 단어를 쓰게 되는데, 학습자가 그 단어의 뜻을 몰라서 문제를
못 푸는 일이 없도록, question마다 "hints" 배열을 함께 반환합니다. hints에는 그 문장에 쓰인
단어 중 summary 5문장 전체에 등장하지 않는 단어만 word(영어 단어 원형)와 meaning(한국어 뜻)으로
담습니다. summary에 이미 나온 단어는 hints에 넣지 않습니다. 새 단어가 없으면 빈 배열 []을
반환합니다.

## quiz
- summary 문장만으로 판단 가능한 True/False 문제 정확히 3개.
- 각 문제는 summary의 문장을 그대로 옮기지 말고, 표현을 바꾸거나(paraphrase) 두 문장의 정보를
  하나로 결합해 판단하게 만들어 단순 단어 매칭으로는 못 풀게 합니다. 다만 summary에 없는 외부
  지식이 필요한 내용을 새로 만들어서는 안 됩니다.
- answer는 boolean(true 또는 false)이며, 세 문제 중 true와 false가 모두 포함되도록 구성합니다.
- explanation은 정답 판단 근거를 한국어 한 문장으로 설명합니다(정답 공개 후 학습자에게 보여줄 문장).
- hints는 위에서 설명한 규칙대로, question에 쓰였지만 summary에는 없는 단어의 뜻 목록입니다.

## 출력 규칙
- 반드시 지정된 JSON 스키마(길이 3의 배열)로만 출력하세요.
- JSON 이외의 설명, 인사말, 마크다운 코드블록을 출력하지 마세요.`;

export async function generateQuiz(
  newsTitle: string,
  summary: string[]
): Promise<AiContent["quiz"]> {
  const userText = `뉴스 주제:\n${newsTitle}\n\n학습자에게 이미 보여준 영어 요약 문장 5개:\n${summary
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n")}\n\n위 문장들을 바탕으로 True/False 문제를 생성하세요.`;

  const parsed = await callGemini(QUIZ_SYSTEM_PROMPT, userText, QUIZ_SCHEMA);
  return validateQuiz(parsed);
}

function validateQuiz(value: unknown): AiContent["quiz"] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error("Gemini 응답 구조(quiz)가 예상과 다릅니다.");
  }

  return value.map((item) => ({
    question: String(item?.question ?? ""),
    answer: Boolean(item?.answer),
    explanation: String(item?.explanation ?? ""),
    hints: toHints(item?.hints),
  }));
}

// ── 3단계: blanks (summary + vocabulary만 있으면 독립적으로 생성 가능) ──

const BLANKS_SCHEMA = {
  type: "array",
  minItems: 3,
  maxItems: 3,
  items: {
    type: "object",
    properties: {
      sentence: { type: "string" },
      translation: { type: "string" },
      options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
      answer: { type: "string" },
      hints: HINT_SCHEMA,
      optionHints: { ...HINT_SCHEMA, minItems: 4, maxItems: 4 },
    },
    required: ["sentence", "translation", "options", "answer", "hints", "optionHints"],
  },
};

const BLANKS_SYSTEM_PROMPT = `당신은 영어 뉴스 요약문을 바탕으로 빈칸 채우기 문제를 만드는 영어교육 전문가입니다.

입력으로 학습자에게 이미 보여준 영어 요약 문장 5개(summary)와, 화면에 뜻과 함께 이미 노출된
핵심 어휘 목록(vocabulary)이 주어집니다. summary에 명확히 나타난 사실만 근거로 사용하세요 —
summary에 없는 배경, 원인, 결과, 외부 지식을 추측해서 새로 만들지 마세요.

## 중요 지침 — summary 문장을 그대로 재사용하지 않는다
sentence는 summary에 있는 문장을 한두 단어만 바꿔서 쓰면 안 됩니다. 같은 사실을 다른 어순·
다른 문장 구조·동의어로 다시 쓴(paraphrase) 새로운 문장이어야 합니다. summary 문장과 겹치는
5단어 이상의 연속된 구절이 있으면 안 됩니다. paraphrase한 문장도 summary와 같은 CEFR B1~B2
난이도를 유지해야 합니다 — 단순한 단어나 짧은 구조로 쉽게 낮춰 쓰지 마세요.

paraphrase를 위해 summary에 없던 새 단어를 쓰게 되는데, 학습자가 그 단어의 뜻을 몰라서 문제를
못 푸는 일이 없도록, sentence마다 "hints" 배열을 함께 반환합니다. hints에는 그 문장에 쓰인
단어 중 summary 5문장 전체에 등장하지 않는 단어만 word(영어 단어 원형)와 meaning(한국어 뜻)으로
담습니다. summary에 이미 나온 단어는 hints에 넣지 않습니다.

## blanks (빈칸 채우기)
- summary 문장 중 3개를 골라, 그 문장이 담은 사실을 표현을 바꿔 새로운 문장으로 다시 쓴다
  (paraphrase). summary 문장에서 단어 하나만 빼고 나머지를 그대로 베끼는 것은 금지한다 —
  어순을 바꾸거나, 능동/수동을 바꾸거나, 동의어로 교체하는 등 실제로 다른 문장으로 만든다.
- 매우 중요: 빈칸의 정답 단어는 입력으로 받은 vocabulary 목록에 있는 단어이거나 summary
  원문에 실제로 쓰인 단어여서는 절대 안 된다. vocabulary 목록은 화면에 뜻과 함께 그대로
  노출되기 때문에, 그 단어를 정답으로 쓰면 학습자가 뜻을 몰라도 목록에서 베껴 맞힐 수 있다.
  대신 summary에서 다루는 개념을 나타내는 다른 동의어·유의 표현을 새로 골라 문장에 쓰고,
  그 동의어를 "______"로 가린다.
  예: summary에 "announced"가 쓰였다면 blanks 문장에는 announced를 그대로 쓰지 않고
  "revealed"나 "confirmed" 같은 동의어로 바꿔 쓰고, 그 동의어(revealed/confirmed)를
  빈칸의 정답으로 삼는다.
- options는 정답 동의어를 포함해 정확히 4개. 나머지 3개는 같은 품사·비슷한 난이도이지만,
  이 문장 빈칸에 넣었을 때 명백히 의미가 이상하거나 틀린 단어여야 한다.
  매우 중요: 나머지 3개끼리, 그리고 정답과 서로 동의어이거나 이 문맥에서 바꿔 써도 자연스러운
  단어이면 절대 안 된다. 문장에 넣어봤을 때 정답 하나만 말이 되고 나머지 3개는 명백히
  어색하거나 틀려야 한다 — 나머지 3개까지 문맥상 그럴듯하면 정답이 여러 개가 되어 버린다.
  나쁜 예 (전부 "성공적으로 해냈다"는 비슷한 뜻이라 문장에 다 자연스럽게 들어감 — 금지):
    "Kim Min-seok successfully ______ the contest." options: succeeded, prevailed, dominated, triumphed
  좋은 예 (정답 prevailed만 말이 되고, 나머지는 이 문맥에 명백히 안 어울림):
    options: prevailed, apologized, resigned, hesitated
- answer는 options 중 정답 단어와 정확히 동일한 문자열이어야 한다.
- hints는 위에서 설명한 규칙대로, sentence(정답 단어 포함)에 쓰였지만 summary에는 없는
  단어의 뜻 목록이다. 정답 단어 자체도 summary에 없는 새 단어이므로 반드시 hints에 포함한다.
- optionHints는 options 4개 전부(정답 포함)에 대한 뜻을 word/meaning으로 담는다, 정확히 4개.
  options에 쓰인 단어들은 대부분 학습자에게 낯설 수 있는 수준이라, 제출 후 "이 단어들이
  각각 무슨 뜻인지" 해설로 보여주기 위한 것이다. options 배열과 같은 순서일 필요는 없지만
  4개 단어 모두 빠짐없이 포함해야 한다.
- translation은 sentence의 빈칸에 정답 단어를 채운 완성된 문장을 자연스러운 한국어로
  번역한 것이다(빈칸이나 "______" 표시 없이, 완전한 한국어 문장으로). summary의 translation과
  같은 톤·문체를 유지한다. 이것도 제출 후 해설에 같이 보여준다.

## 출력 규칙
- 반드시 지정된 JSON 스키마(길이 3의 배열)로만 출력하세요.
- JSON 이외의 설명, 인사말, 마크다운 코드블록을 출력하지 마세요.`;

export async function generateBlanks(
  newsTitle: string,
  summary: string[],
  vocabulary: AiContent["vocabulary"]
): Promise<AiContent["blanks"]> {
  const userText = `뉴스 주제:\n${newsTitle}\n\n학습자에게 이미 보여준 영어 요약 문장 5개:\n${summary
    .map((s, i) => `${i + 1}. ${s}`)
    .join(
      "\n"
    )}\n\n화면에 뜻과 함께 이미 노출된 핵심 어휘(빈칸 정답으로 쓰면 안 됨):\n${vocabulary
    .map((v) => `${v.word} — ${v.meaning}`)
    .join(", ")}\n\n위 자료를 바탕으로 빈칸 채우기 문제를 생성하세요.`;

  const parsed = await callGemini(BLANKS_SYSTEM_PROMPT, userText, BLANKS_SCHEMA);
  return validateBlanks(parsed);
}

function validateBlanks(value: unknown): AiContent["blanks"] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error("Gemini 응답 구조(blanks)가 예상과 다릅니다.");
  }

  return value.map((item) => {
    const options = Array.isArray(item?.options) ? item.options.map((o: unknown) => String(o)) : [];
    if (options.length !== 4) {
      throw new Error("Gemini 응답의 blanks.options 개수가 4개가 아닙니다.");
    }
    // 모델이 밑줄 개수를 정확히 지키지 않을 수 있어, 길이와 무관하게 항상 "______"(6개)로 통일한다.
    const sentence = String(item?.sentence ?? "").replace(/_{3,}/g, "______");
    return {
      sentence,
      translation: String(item?.translation ?? ""),
      options,
      answer: String(item?.answer ?? ""),
      hints: toHints(item?.hints),
      optionHints: toHints(item?.optionHints),
    };
  });
}

// ── 온디맨드 경로용 조합 함수: 1단계 → 2·3단계(병렬) → 병합 ──
// /api/generate처럼 그 자리에서 바로 응답에 써야 하는 경우, 배치와 달리 단계별로
// 저장할 필요는 없으므로 세 단계를 이어 호출해 완성된 AiContent 하나로 돌려준다.

export async function generateLearningMaterial(
  newsTitle: string,
  articles: NaverArticle[]
): Promise<AiContent> {
  const core = await generateArticleCore(newsTitle, articles);
  const [quiz, blanks] = await Promise.all([
    generateQuiz(newsTitle, core.summary),
    generateBlanks(newsTitle, core.summary, core.vocabulary),
  ]);

  return { ...core, quiz, blanks };
}
