import { ArrowLeft, ArrowRight, Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BookCard from "../components/BookCard.jsx";
import BookCover from "../components/BookCover.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useProducts } from "../context/ProductsContext.jsx";

export default function BookDetailPage() {
  const { id } = useParams();
  const { products, loading, source, error } = useProducts();
  const { addItem, items } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const book = products.find((item) => item.id === id);
  const stockQuantity = Number(book?.stock_quantity) || 0;
  const inCartQuantity = items.find((item) => item.id === id)?.quantity ?? 0;
  const remainingQuantity = Math.max(0, stockQuantity - inCartQuantity);
  const isAvailable = remainingQuantity > 0 && book?.is_available !== false;

  useEffect(() => {
    setQuantity(1);
  }, [id]);

  useEffect(() => {
    setQuantity((current) => Math.min(current, Math.max(1, remainingQuantity)));
  }, [remainingQuantity]);

  if (loading) return <div className="loading-state">Finding this book…</div>;
  if (error) return <div className="not-found" role="alert"><h1>We couldn’t load this book right now.</h1><p>{error}</p><Link className="button button--outline" to="/shop"><ArrowLeft size={16} /> Back to the shop</Link></div>;
  if (!book) {
    return <div className="not-found"><span className="eyebrow">NOT ON THESE SHELVES</span><h1>We couldn’t find that book.</h1><Link className="button button--primary" to="/shop"><ArrowLeft size={16} /> Back to the shop</Link></div>;
  }

  const related = products.filter((item) => item.id !== book.id && (item.category === book.category || item.tags?.some((tag) => book.tags?.includes(tag)))).slice(0, 3);

  function addToBag() {
    for (let index = 0; index < quantity; index += 1) addItem(book);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="detail-page section-shell">
      <Link className="back-link" to="/shop"><ArrowLeft size={15} /> Back to all books</Link>
      <div className="detail-layout">
        <div className="detail-cover-stage"><BookCover book={book} className="detail-cover" /><span className="detail-stage-note">A good read for your next chapter <span>✳</span></span></div>
        <div className="detail-copy">
          <span className="eyebrow"><span className="eyebrow-line" /> {book.category.toUpperCase()}</span>
          <h1>{book.title}</h1>
          <p className="detail-author">by <span>{book.author}</span></p>
          <div className="detail-rating"><span className="detail-stock-dot" /><span className="availability">{source === "development" ? "Preview stock availability" : isAvailable ? "In stock" : "Currently unavailable"}</span></div>
          <p className="detail-description">{book.description}</p>
          <div className="detail-price">₦{Number(book.price).toLocaleString("en-NG")}<span>{source === "development" ? "Illustrative preview price" : "Current shop price"}</span></div>
          <div className="purchase-row">
            <div className="quantity-control" aria-label="Quantity">
              <button aria-label="Decrease quantity" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={14} /></button>
              <span>{quantity}</span>
              <button aria-label="Increase quantity" onClick={() => setQuantity((value) => Math.min(remainingQuantity, value + 1))} disabled={quantity >= remainingQuantity}><Plus size={14} /></button>
            </div>
            <button className={`button button--primary purchase-button ${added ? "purchase-button--added" : ""}`} onClick={addToBag} disabled={!isAvailable}>
              {added ? <Check size={17} /> : <ShoppingBag size={17} />}{added ? "Added to your bag" : "Add to bag"}
            </button>
          </div>
          <div className="detail-assurance"><span>✳</span><p>Chosen for curious minds<br /><small>We believe the right book can meet you right where you are.</small></p></div>
          {book.isbn && <div className="book-isbn">ISBN <span>{book.isbn}</span></div>}
        </div>
      </div>
      {related.length > 0 && <section className="related-section"><div className="section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> KEEP EXPLORING</span><h2>Along the same <em>path.</em></h2></div><Link className="text-link" to="/shop">See all books <ArrowRight size={15} /></Link></div><div className="book-grid">{related.map((item, index) => <BookCard key={item.id} book={item} index={index} />)}</div></section>}
    </div>
  );
}
