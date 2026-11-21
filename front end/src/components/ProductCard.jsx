export default function ProductCard({ product, onAddToCart }) {
  if (!product) return null;

  return (
    <article className="card h-100">
      {product.image && <img className="card-img-top product-image" src={product.image} alt={product.name} />}
      <div className="card-body d-flex flex-column">
        <h2 className="h5 card-title">{product.name}</h2>
        {product.description && <p className="card-text text-secondary">{product.description}</p>}
        <div className="mt-auto d-flex align-items-center justify-content-between gap-2">
          <strong>{product.price != null ? `${Number(product.price).toLocaleString('vi-VN')} ₫` : 'Liên hệ'}</strong>
          <button className="btn btn-primary btn-sm" onClick={() => onAddToCart?.(product)} type="button">
            Thêm vào giỏ
          </button>
        </div>
      </div>
    </article>
  );
}
