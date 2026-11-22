import { useCart } from '../context/CartContext.jsx';

export default function HomePage() {
  const { addToCart } = useCart();

  return (
    <section>
      <h1 className="h2">Trang chủ</h1>
      <p className="text-secondary">Khung frontend đã sẵn sàng. Kết nối danh sách sản phẩm với API backend ở bước tiếp theo.</p>
      <button className="btn btn-outline-primary" type="button" onClick={() => addToCart({ id: 'sample', name: 'Sản phẩm mẫu', price: 0 })}>
        Thử state giỏ hàng
      </button>
    </section>
  );
}
