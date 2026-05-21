export default function ShopLoading() {
  return (
    <div className="shop-loading">
      <div className="shop-loading__grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shop-loading__card">
            <div className="shop-loading__card-img skel-box" />
            <div className="shop-loading__card-body">
              <div className="skel-box" style={{ height: "0.65rem", width: "55%", borderRadius: 4 }} />
              <div className="skel-box" style={{ height: "0.9rem", borderRadius: 4 }} />
              <div className="skel-box" style={{ height: "0.9rem", width: "70%", borderRadius: 4 }} />
              <div className="skel-box" style={{ height: "1.1rem", width: "40%", borderRadius: 4, marginTop: "0.25rem" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
