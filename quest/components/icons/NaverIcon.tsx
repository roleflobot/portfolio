export default function NaverIcon({ className = '' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/naver-logo.png"
      alt=""
      className={className}
      style={{ width: '1.1em', height: '1.1em' }}
      aria-hidden="true"
    />
  )
}
