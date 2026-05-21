export default function ProductoLoading() {
  return (
    <article className="product-detail">
      <div className="product-detail__grid">
        {/* ─── Galería ─── */}
        <div className="product-detail__gallery">
          <div className="product-detail__main-image skel-box" />
          <div className="product-detail__thumbs">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="skel-box"
                style={{ flexShrink: 0, width: 72, height: 72, borderRadius: "var(--radius-sm)" }}
              />
            ))}
          </div>
        </div>

        {/* ─── Info ─── */}
        <div className="product-detail__info">
          <div className="skel-box" style={{ height: "0.75rem", width: "40%", borderRadius: 4 }} />
          <div className="skel-box" style={{ height: "2rem", width: "75%", borderRadius: 6, marginTop: "0.25rem" }} />
          <div className="skel-box" style={{ height: "1.6rem", width: "35%", borderRadius: 4 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div className="skel-box" style={{ height: "0.75rem", borderRadius: 4 }} />
            <div className="skel-box" style={{ height: "0.75rem", width: "85%", borderRadius: 4 }} />
            <div className="skel-box" style={{ height: "0.75rem", width: "60%", borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skel-box" style={{ height: "2.2rem", width: "3.5rem", borderRadius: "var(--radius-sm)" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skel-box" style={{ width: 32, height: 32, borderRadius: "50%" }} />
            ))}
          </div>
          <div className="skel-box" style={{ height: "3rem", borderRadius: "var(--radius-sm)", marginTop: "0.5rem" }} />
        </div>
      </div>
    </article>
  );
}
