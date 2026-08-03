interface NaverPlace {
  roadAddress: string
  lat: number
  lng: number
}

/**
 * 네이버 지역 검색 API로 식당명을 조회해 도로명주소와 좌표를 가져온다.
 * 실패하거나 결과가 없으면 null을 반환한다 (호출부에서 등록/수정을 막지 않는다).
 */
export async function searchNaverPlace(query: string): Promise<NaverPlace | null> {
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return null
  }

  try {
    const url =
      'https://naverapihub.apigw.ntruss.com/search/v1/local?' +
      new URLSearchParams({ query, display: '1' })

    const res = await fetch(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    })

    if (!res.ok) {
      return null
    }

    const json = await res.json()
    const item = json.items?.[0]
    if (!item) {
      return null
    }

    return {
      roadAddress: item.roadAddress,
      lat: Number(item.mapy) / 1e7,
      lng: Number(item.mapx) / 1e7,
    }
  } catch {
    return null
  }
}
