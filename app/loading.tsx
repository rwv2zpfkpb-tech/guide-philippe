export default function Loading() {
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
        }}
      >
        <div className="gp-spinner" />
        <span
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontStyle: 'italic',
            fontSize: '1.05rem',
            color: 'var(--c-n400)',
            letterSpacing: '0.06em',
          }}
        >
          Guide Philippe
        </span>
      </div>
    </main>
  )
}
