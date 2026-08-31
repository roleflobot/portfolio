export type PartOfSpeech = "verb" | "noun" | "adjective" | "adverb";

export type VocabularyItem = {
  word: string;
  meaning: string;
  /** 복습 퀴즈에서 오답 보기를 고를 때 품사를 맞추기 위한 태그. */
  pos: PartOfSpeech;
};

export type WordHint = {
  word: string;
  meaning: string;
};

export type QuizItem = {
  question: string;
  answer: boolean;
  explanation: string;
  /** question에 쓰였지만 지문(summary)에는 없는 단어에 대한 뜻 힌트 */
  hints: WordHint[];
};

export type BlankItem = {
  /** 정답 단어 자리에 "_____"가 들어간 문장 */
  sentence: string;
  /** 빈칸에 정답을 채운 완성 문장의 한국어 해석. 제출 후 해설에 보여준다. */
  translation: string;
  options: string[];
  answer: string;
  /** sentence에 쓰였지만 지문(summary)에는 없는 단어에 대한 뜻 힌트 */
  hints: WordHint[];
  /** options 4개 전부(정답 포함)의 뜻. 제출 후 해설로 보여준다. */
  optionHints: WordHint[];
};

export type AiContent = {
  summary: string[];
  translation: string[];
  vocabulary: VocabularyItem[];
  quiz: QuizItem[];
  blanks: BlankItem[];
  /** Section 5(영작) 활동에서 학습자가 전부 사용해야 하는 단어 5개. 예전 세션엔 없을 수 있다. */
  writingWords: string[];
};

export type SavedAnswers = {
  quiz: boolean[];
  blanks: string[];
};

export type LearningSession = {
  id: string;
  user_id: string | null;
  topic: string | null;
  category: string | null;
  news_title: string;
  news_url: string | null;
  news_description: string | null;
  ai_content: AiContent;
  /** 지문 낭독 TTS 오디오(WAV)를 base64로 미리 생성해둔 것. 없으면 재생 시 즉석 생성으로 폴백한다. */
  audio_base64: string | null;
  /** 예전 세션은 boolean[](TF만), 새 세션은 SavedAnswers(TF+빈칸) 형태다. */
  user_answers: SavedAnswers | boolean[] | null;
  score: number | null;
  created_at: string;
};
