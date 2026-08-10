import { XMLParser } from "fast-xml-parser";

export type NewsHeadline = {
  title: string;
  url: string;
};

export type NaverArticle = {
  title: string;
  description: string;
};

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/**
 * Google 뉴스 RSS(한국, 주요 헤드라인)에서 오늘의 뉴스 후보를 가져온다.
 * 원본 n8n 워크플로의 "Google 뉴스 주요 주제 조회" 노드와 동일한 소스를 사용한다.
 * exact-title dedup까지가 이 함수의 역할(1차 rule-based 정리)이며,
 * 의미적 중복 제거·주제 선정은 gemini.ts의 selectTopTopics가 담당한다.
 */
export async function fetchTopHeadlines(limit = 30): Promise<NewsHeadline[]> {
  const res = await fetch("https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Google 뉴스 RSS 조회 실패: ${res.status}`);
  }

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  const items = parsed?.rss?.channel?.item;
  const list: unknown[] = Array.isArray(items) ? items : items ? [items] : [];

  const seen = new Set<string>();
  const headlines: NewsHeadline[] = [];

  for (const raw of list) {
    const item = raw as { title?: unknown; link?: unknown };
    const rawTitle = typeof item.title === "string" ? item.title : "";
    // Google 뉴스 RSS 제목은 보통 "기사 제목 - 언론사" 형태이므로 언론사 표기를 제거한다.
    const title = stripHtml(rawTitle).replace(/\s-\s[^-]+$/, "").trim();
    const url = typeof item.link === "string" ? item.link : "";

    if (!title || !url || seen.has(title)) continue;
    seen.add(title);
    headlines.push({ title, url });

    if (headlines.length >= limit) break;
  }

  return headlines;
}

/**
 * 선택된 뉴스 제목을 키워드로 NAVER 뉴스 검색 API(NAVER API HUB, NCP)를 호출해
 * 학습자료 생성에 사용할 title/description 후보를 가져온다.
 *
 * 이 검색 API는 예전 openapi.naver.com(X-Naver-Client-Id 방식)에서
 * NAVER API HUB(NCP, X-NCP-APIGW-API-KEY 방식)로 이전되었다.
 */
export async function fetchNaverArticles(
  query: string,
  limit = 5
): Promise<NaverArticle[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "NAVER API 자격증명이 설정되지 않았습니다. .env.local에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET을 채워주세요."
    );
  }

  const url = new URL("https://naverapihub.apigw.ntruss.com/search/v1/news");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(limit));
  url.searchParams.set("sort", "sim");

  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`NAVER 뉴스 검색 실패: ${res.status}`);
  }

  const data = (await res.json()) as {
    items?: { title: string; description: string }[];
  };

  return (data.items ?? []).map((item) => ({
    title: stripHtml(item.title),
    description: stripHtml(item.description),
  }));
}
