import { ArrowUpRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { useProducts } from "../context/ProductsContext.jsx";
import BookCover from "./BookCover.jsx";

export default function BookCard({ book, index = 0 }) {
  const { addItem, items } = useCart();
  const { source } = useProducts();
  const cartQuantity = items.find((item) => item.id === book.id)?.quantity ?? 0;
  const stockQuantity = Number(book.stock_quantity) || 0;
  const atStockLimit = stockQuantity < 1 || book.is_available === false || cartQuantity >= stockQuantity;
  const availability = source === "development"
    ? "Preview availability"
    : book.is_available === false
      ? "Unavailable"
      : stockQuantity > 0
      ? "In stock"
      : "Sold out";

  return (
    <article className="book-card" style={{ "--card-index": index }}>
      <Link className="book-card__cover-link" to={`/shop/${book.id}`}>
        <BookCover book={book} />
        <span className="book-card__open" aria-label={`View ${book.title}`}>
          <ArrowUpRight size={17} />
        </span>
      </Link>
      <div className="book-card__body">
        <div className="book-card__meta">
          <span>{book.category}</span>
          <span className="book-stock-preview"><span className="stock-dot" /> {availability}</span>
        </div>
        <Link to={`/shop/${book.id}`} className="book-card__title">{book.title}</Link>
        <p className="book-card__author">by {book.author}</p>
        <div className="book-card__bottom">
          <strong>₦{Number(book.price).toLocaleString("en-NG")}</strong>
          <button
            className="icon-button add-button"
            onClick={() => addItem(book)}
            disabled={atStockLimit}
            aria-label={atStockLimit ? `${book.title} stock limit reached` : `Add ${book.title} to cart`}
            title={atStockLimit ? "Maximum available quantity is already in your bag" : "Add to cart"}
          >
            <Plus size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
