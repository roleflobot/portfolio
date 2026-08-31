import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CategoryTag } from "@/components/CategoryStamp";

export const dynamic = "force-dynamic";

type HistoryRow = {
  id: string;
  topic: string | null;
  category: string | null;
  news_title: string;
  score: number | null;
  created_at: string;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function HistoryPage() {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("learning_sessions")
    .select("id, topic, category, news_title, score, created_at")
    .order("created_at", { ascending: false })
    .returns<HistoryRow[]>();

  // 같은 뉴스를 여러 번 학습했으면(재학습, 테스트 등) 최근 것 하나만 보여준다 —
  // created_at 내림차순으로 이미 정렬돼 있으므로 news_title별 첫 등장이 최신 것이다.
  const seenTitles = new Set<string>();
  const data = rows?.filter((row) => {
    if (seenTitles.has(row.news_title)) return false;
    seenTitles.add(row.news_title);
    return true;
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link
        href="/"
        className="font-mono text-xs text-ink-faint uppercase hover:text-ink"
      >
        ← 홈으로
      </Link>

      <h1 className="mt-3 font-serif text-2xl font-bold">학습 기록</h1>

      {error && (
        <p className="mt-8 text-danger">
          학습 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      )}

      {!error && (!data || data.length === 0) && (
        <p className="mt-8 text-ink-faint">
          아직 학습한 기록이 없습니다. 홈에서 뉴스를 선택해 학습을 시작해보세요.
        </p>
      )}

      {!error && data && data.length > 0 && (
        <div className="mt-6 rounded-md border border-border bg-surface px-6">
          {data.map((row, i) => (
            <Link
              key={row.id}
              href={`/study/${row.id}`}
              className={`block py-4 hover:bg-surface-2 ${
                i !== data.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {row.category ? (
                  <CategoryTag category={row.category} />
                ) : (
                  <span className="font-mono text-[0.7rem] text-ink-faint uppercase">
                    UNKNOWN
                  </span>
                )}
                <span className="font-mono text-xs text-ink-faint">
                  {row.score !== null ? `${row.score} PTS` : "미완료"}
                </span>
              </div>
              <div className="mt-1.5 font-semibold">{row.topic || row.news_title}</div>
              <div className="mt-0.5 text-sm text-ink-soft">{row.news_title}</div>
              <div className="mt-1 font-mono text-[0.7rem] text-ink-faint">
                {formatDate(row.created_at)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
