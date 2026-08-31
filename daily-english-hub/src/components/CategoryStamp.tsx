import type { CSSProperties } from "react";

export const CATEGORIES = ["정치", "국제", "사회", "경제", "과학기술", "문화"] as const;
export type Category = (typeof CATEGORIES)[number];

const STYLE: Record<Category, { text: string; tint: string }> = {
  정치: { text: "text-cat-politics", tint: "bg-cat-politics-tint" },
  국제: { text: "text-cat-world", tint: "bg-cat-world-tint" },
  사회: { text: "text-cat-society", tint: "bg-cat-society-tint" },
  경제: { text: "text-cat-economy", tint: "bg-cat-economy-tint" },
  과학기술: { text: "text-cat-tech", tint: "bg-cat-tech-tint" },
  문화: { text: "text-cat-culture", tint: "bg-cat-culture-tint" },
};

/** 카테고리별 잉크 도장 스타일 아이콘. 실제 기사 사진 대신 일관된 기호로 사용한다. */
function CategoryIcon({
  category,
  className,
  style,
}: {
  category: Category;
  className?: string;
  style?: CSSProperties;
}) {
  const common = {
    viewBox: "0 0 40 40",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    className,
    style,
  };

  switch (category) {
    case "정치":
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="17" />
          <path d="M13 24h14M14 24v-6l6-5 6 5v6" />
        </svg>
      );
    case "국제":
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="17" />
          <ellipse cx="20" cy="20" rx="8" ry="17" />
          <path d="M3 20h34M6 12h28M6 28h28" />
        </svg>
      );
    case "사회":
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="17" />
          <path d="M13 27V16l7-4 7 4v11M13 27h14M17 27v-5h6v5" />
        </svg>
      );
    case "경제":
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="17" />
          <path d="M13 25l5-6 4 4 6-8M13 27h14" />
        </svg>
      );
    case "과학기술":
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="17" />
          <circle cx="20" cy="20" r="3" />
          <ellipse cx="20" cy="20" rx="13" ry="5" />
          <ellipse cx="20" cy="20" rx="13" ry="5" transform="rotate(60 20 20)" />
        </svg>
      );
    case "문화":
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="17" />
          <path d="M13 17c0-3 2-5 4-5 1.5 0 2 1 3 1s1.5-1 3-1c2 0 4 2 4 5 0 5-7 9-7 9s-7-4-7-9z" />
        </svg>
      );
  }
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** 목록에서 쓰는 작은 태그 (모노스페이스 라벨 + 점 + 색). */
export function CategoryTag({ category }: { category: string }) {
  const cat = isCategory(category) ? category : "사회";
  const style = STYLE[cat];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-mono text-[0.7rem] uppercase ${style.text} ${style.tint}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {cat}
    </span>
  );
}

/** 학습 화면 등에서 쓰는 큰 도장 아이콘. */
export function CategoryStamp({ category, size = 40 }: { category: string; size?: number }) {
  const cat = isCategory(category) ? category : "사회";
  const style = STYLE[cat];
  return (
    <CategoryIcon category={cat} className={style.text} style={{ width: size, height: size }} />
  );
}
