import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import BookCover from "../components/BookCover.jsx";
import { useCart } from "../context/CartContext.jsx";

function formatNaira(value) {
  return `₦${Number(value).toLocaleString("en-NG")}`;
}

export default function CartPage() {
  const { items, subtotal, setQuantity, removeItem } = useCart();
  const totalItems = items.reduce((total, item) => total + item.quantity, 0);

  if (!items.length) {
    return <div className="cart-empty section-shell"><div className="cart-empty__icon"><ShoppingBag size={25} /></div><span className="eyebrow"><span className="eyebrow-line" /> YOUR BOOK BAG</span><h1>A little room for <em>your next read.</em></h1><p>Your bag is waiting for a book to call its own.</p><Link className="button button--primary" to="/shop">Explore the bookshelves <ArrowRight size={16} /></Link></div>;
  }

  return (
    <div className="cart-page section-shell">
      <Link to="/shop" className="back-link"><ArrowLeft size={15} /> Keep exploring</Link>
      <div className="page-intro page-intro--left"><span className="eyebrow"><span className="eyebrow-line" /> YOUR BOOK BAG</span><h1>Good choices. <em>Good company.</em></h1><p>{totalItems} {totalItems === 1 ? "book" : "books"} ready for your next chapter.</p></div>
      <div className="cart-layout">
        <section className="cart-items" aria-label="Items in your bag">
          {items.map((book) => (
            <article className="cart-item" key={book.id}>
              <Link to={`/shop/${book.id}`} className="cart-item__cover"><BookCover book={book} /></Link>
              <div className="cart-item__info"><span className="cart-item__category">{book.category}</span><Link to={`/shop/${book.id}`} className="cart-item__title">{book.title}</Link><span className="cart-item__author">{book.author}</span><button className="remove-item" onClick={() => removeItem(book.id)}><Trash2 size={13} /> Remove</button></div>
              <div className="cart-item__controls"><strong>{formatNaira(book.price * book.quantity)}</strong><div className="quantity-control"><button aria-label={`Decrease ${book.title} quantity`} onClick={() => setQuantity(book.id, book.quantity - 1)}><Minus size={13} /></button><span>{book.quantity}</span><button aria-label={`Increase ${book.title} quantity`} onClick={() => setQuantity(book.id, book.quantity + 1)} disabled={book.quantity >= book.stock_quantity}><Plus size={13} /></button></div></div>
            </article>
          ))}
        </section>
        <aside className="cart-summary">
          <span className="eyebrow">A LITTLE SUMMARY</span>
          <h2>Your bag, so far.</h2>
          <div className="summary-row"><span>Books ({items.reduce((total, item) => total + item.quantity, 0)})</span><strong>{formatNaira(subtotal)}</strong></div>
          <div className="summary-row summary-row--muted"><span>Delivery</span><span>Calculated at checkout</span></div>
          <div className="summary-total"><span>Subtotal</span><strong>{formatNaira(subtotal)}</strong></div>
          <p className="summary-note">Shipping and delivery details will be confirmed before placing your order.</p>
          <Link className="button button--primary summary-checkout" to="/checkout">Continue to checkout <ArrowRight size={16} /></Link>
          <div className="summary-quote"><span>✳</span> Every new perspective starts somewhere.</div>
        </aside>
      </div>
      <p className="preview-price-note">Prices and stock shown are development examples, not verified D’Bridge inventory.</p>
    </div>
  );
}
