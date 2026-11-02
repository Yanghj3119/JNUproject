export default function PageHeader({ icon, title, sub, children }) {
  return (
    <div className="jp-pagehead">
      <div>
        <h1 className="h3 fw-bold mb-1">{icon && <i className={`bi bi-${icon} me-2 text-jp`} />}{title}</h1>
        {sub && <p className="text-muted mb-0">{sub}</p>}
      </div>
      {children}
    </div>
  )
}
