'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    naver: any
  }
}

interface MiniMapProps {
  lat: number
  lng: number
  name: string
}

export default function MiniMap({ lat, lng, name }: MiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [scriptFailed, setScriptFailed] = useState(false)
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID

  useEffect(() => {
    if (!scriptLoaded || !mapRef.current || !window.naver?.maps) return

    const center = new window.naver.maps.LatLng(lat, lng)
    const map = new window.naver.maps.Map(mapRef.current, {
      center,
      zoom: 16,
      scrollWheel: false,
    })

    new window.naver.maps.Marker({ position: center, map, title: name })
  }, [scriptLoaded, lat, lng, name])

  if (!clientId) return null

  if (scriptFailed) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 p-4">
        지도 미리보기를 불러오지 못했습니다.
      </p>
    )
  }

  return (
    <>
      <Script
        src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`}
        onLoad={() => setScriptLoaded(true)}
        onError={() => setScriptFailed(true)}
      />
      <div ref={mapRef} className="w-full h-64 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800" />
    </>
  )
}
