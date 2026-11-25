import { money } from '../reservationFormat.js';

export default function PriceSummary({ price }) {
  return (
    <dl className="rv-price">
      <div><dt>Giá trước ưu đãi</dt><dd>{money(price.subtotal)}</dd></div>
      {price.surcharge > 0 && <div><dt>Phụ phí báo giá</dt><dd>{money(price.surcharge)}</dd></div>}
      {price.discount > 0 && <div><dt>Giảm giá</dt><dd>−{money(price.discount)}</dd></div>}
      <div className="rv-total"><dt>Tổng báo giá</dt><dd>{money(price.total)}</dd></div>
    </dl>
  );
}
