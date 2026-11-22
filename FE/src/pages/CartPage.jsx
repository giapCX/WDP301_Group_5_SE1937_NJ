import { useCart } from '../context/CartContext.jsx';

export default function CartPage() {
  const { items, removeFromCart, clearCart } = useCart();

  return (
    <section>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h2 mb-0">Giỏ hàng</h1>
        {items.length > 0 && <button className="btn btn-outline-danger btn-sm" onClick={clearCart}>Xóa tất cả</button>}
      </div>
      {items.length === 0 ? <p className="text-secondary">Giỏ hàng đang trống.</p> : (
        <ul className="list-group">
          {items.map((item) => {
            const id = item._id ?? item.id;
            return <li className="list-group-item d-flex justify-content-between align-items-center" key={id}>
              <span>{item.name} <span className="text-secondary">× {item.quantity}</span></span>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => removeFromCart(id)}>Xóa</button>
            </li>;
          })}
        </ul>
      )}
    </section>
  );
}
