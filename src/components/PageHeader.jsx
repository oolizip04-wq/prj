export default function PageHeader({ icon, title, subtitle }) {
  return (
    <header className="mb-4">
      <h2 className="fw-bold">{icon && <i className={`bi bi-${icon} me-2 text-primary`} />}{title}</h2>
      {subtitle && <p className="text-muted mb-0">{subtitle}</p>}
    </header>
  )
}
