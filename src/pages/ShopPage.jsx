import { ArrowDownWideNarrow, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BookCard from "../components/BookCard.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { categories } from "../data/books.js";
import { useProducts } from "../context/ProductsContext.jsx";

export default function ShopPage() {
  const { products, loading, error, source } = useProducts();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [sort, setSort] = useState("featured");
  const activeCategory = searchParams.get("category") ?? "All books";

  const visibleBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = products.filter((book) => {
      const categoryMatch = activeCategory === "All books" || book.category === activeCategory;
      const searchText = [book.title, book.author, book.category, ...(book.tags ?? [])].join(" ").toLowerCase();
      return categoryMatch && (!normalizedQuery || searchText.includes(normalizedQuery));
    });

    if (sort === "price-low") filtered.sort((a, b) => a.price - b.price);
    if (sort === "price-high") filtered.sort((a, b) => b.price - a.price);
    if (sort === "title") filtered.sort((a, b) => a.title.localeCompare(b.title));
    return filtered;
  }, [products, query, activeCategory, sort]);

  function setCategory(category) {
    const next = new URLSearchParams(searchParams);
    if (category === "All books") next.delete("category");
    else next.set("category", category);
    setSearchParams(next);
  }

  if (loading) return <LoadingState message="Opening the shelves…" />;

  return (
    <div className="shop-page section-shell">
      <div className="page-intro">
        <span className="eyebrow"><span className="eyebrow-line" /> THE BOOKSHOP</span>
        <h1>A good place to <em>begin.</em></h1>
        <p>Browse books for the ideas you’re ready to explore and the person you’re becoming.</p>
      </div>
      {source === "development" && <div className="catalog-notice catalog-notice--inline"><span>Preview catalog</span><span>Sample titles and prices only; real D’Bridge inventory has not been supplied yet.</span></div>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="shop-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by book, author or idea…" aria-label="Search books" />
          {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
        </label>
        <label className="sort-select"><ArrowDownWideNarrow size={16} /><span>Sort:</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort books">
            <option value="featured">Recommended</option>
            <option value="title">Title A–Z</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </label>
      </div>
      <div className="shop-content">
        <aside className="category-sidebar" id="categories">
          <div className="sidebar-title"><SlidersHorizontal size={15} /> Browse by</div>
          {categories.map((category) => (
            <button className={activeCategory === category ? "category-option category-option--active" : "category-option"} key={category} onClick={() => setCategory(category)}>
              {category}<span>{category === "All books" ? products.length : products.filter((book) => book.category === category).length}</span>
            </button>
          ))}
          <div className="sidebar-prompt"><span>Not sure yet?</span><p>Tell us what you’re looking to grow.</p><a href="/recommend">Get a little guidance ↗</a></div>
        </aside>
        <section className="catalog-results" aria-label="Book catalog">
          <div className="results-heading"><span>{visibleBooks.length} {visibleBooks.length === 1 ? "book" : "books"} to explore</span><span>{activeCategory === "All books" ? "All shelves" : activeCategory}</span></div>
          {error ? (
            <div className="empty-state"><span className="empty-state__icon">⌁</span><h2>The shelves are taking a moment.</h2><p>{error}</p><button className="button button--outline" onClick={() => window.location.reload()}>Try again</button></div>
          ) : visibleBooks.length ? (
            <div className="book-grid book-grid--shop">{visibleBooks.map((book, index) => <BookCard key={book.id} book={book} index={index} />)}</div>
          ) : (
            <div className="empty-state"><span className="empty-state__icon">⌕</span><h2>No books found just yet.</h2><p>Try another search or explore all of our shelves.</p><button className="button button--outline" onClick={() => { setQuery(""); setCategory("All books"); }}>Clear filters</button></div>
          )}
        </section>
      </div>
    </div>
  );
}
