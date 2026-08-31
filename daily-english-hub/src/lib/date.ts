/**
 * "오늘의 뉴스 5개"를 가리키는 콘텐츠 날짜를 'YYYY-MM-DD'로 반환한다.
 * 자정이 아니라 새벽 3시를 하루의 경계로 삼는다 — 배치가 3시에 그날 주제를 선정하므로,
 * 자정~3시 사이에 첫 방문자가 오면 아직 배치가 돌기 전인 "어제" 콘텐츠를 그대로 보여줘야
 * 한다. 3시간을 미리 빼서 계산하면 자정이 지나도 3시 전까지는 날짜가 안 바뀐다.
 */
export function getKstDateString(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(shifted);
}
