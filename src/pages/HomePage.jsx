import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import BookCard from "../components/BookCard.jsx";
import BookCover from "../components/BookCover.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { discoveryGoals } from "../data/books.js";
import { useProducts } from "../context/ProductsContext.jsx";

export default function HomePage() {
  const { products, source, loading, error } = useProducts();
  if (loading) return <LoadingState message="Opening the bookshelves…" />;
  if (error) {
    return <div className="catalog-failure section-shell" role="alert"><span className="eyebrow"><span className="eyebrow-line" /> THE BOOKSHOP</span><h1>Our shelves are taking a moment.</h1><p>{error}</p><button className="button button--outline" onClick={() => window.location.reload()}>Try again</button></div>;
  }

  const featured = products.filter((book) => book.featured).slice(0, 4);
  const heroBook = products.find((book) => book.id === "atomic-habits") ?? products[0];

  return (
    <div className="home-page">
      {source === "development" && (
        <div className="catalog-notice">
          <span>Preview catalog</span>
          <span>Sample titles and prices for development only — not confirmed shop inventory.</span>
        </div>
      )}
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> A BOOKSHOP FOR YOUR NEXT CHAPTER</div>
          <h1>Find the right book for <em>where you’re going.</em></h1>
          <p className="hero-description">Thoughtful reads for the life you’re building. Discover books to help you learn, grow, lead and become more.</p>
          <div className="hero-actions">
            <Link className="button button--primary" to="/shop">Explore books <ArrowRight size={17} /></Link>
            <Link className="button button--quiet" to="/recommend"><Sparkles size={16} /> Help me find a book</Link>
          </div>
          <div className="hero-proof">
            <span className="hero-proof__mark"><BookOpen size={15} /></span>
            <div><strong>A thoughtful place to begin.</strong><span>Curated around what matters to you.</span></div>
          </div>
        </div>
        <div className="hero-art" aria-label="A selection of books for your next chapter">
          <div className="hero-art__halo" />
          <div className="hero-art__note"><span>✳</span> Your next chapter<br />starts here</div>
          <div className="hero-art__book hero-art__book--back">
            <BookCover book={products.find((book) => book.id === "start-with-why") ?? heroBook} />
          </div>
          <div className="hero-art__book hero-art__book--front">
            <BookCover book={heroBook} />
          </div>
          <div className="hero-art__book hero-art__book--side">
            <BookCover book={products.find((book) => book.id === "psychology-of-money") ?? heroBook} />
          </div>
          <div className="hero-art__caption"><BookOpen size={15} /> Stories for growth, purpose & possibility</div>
          <span className="hero-spark hero-spark--one">✳</span>
          <span className="hero-spark hero-spark--two">✳</span>
        </div>
        <a href="#discover" className="hero-scroll" aria-label="Scroll to discover"><span>SCROLL TO DISCOVER</span><ArrowDown size={14} /></a>
      </section>

      <section className="discovery-section section-shell" id="discover">
        <div className="section-heading">
          <div><span className="eyebrow"><span className="eyebrow-line" /> START WITH WHAT MATTERS</span><h2>What are you growing <em>towards?</em></h2></div>
          <Link className="text-link" to="/recommend">Find your next read <ArrowUpRight size={15} /></Link>
        </div>
        <div className="goal-grid">
          {discoveryGoals.map((goal, index) => (
            <Link className={`goal-card goal-card--${index + 1}`} key={goal.label} to={`/recommend?goal=${encodeURIComponent(goal.label)}`}>
              <span className="goal-card__icon">{goal.icon}</span>
              <span className="goal-card__label">{goal.label}</span>
              <ArrowUpRight className="goal-card__arrow" size={16} />
            </Link>
          ))}
        </div>
      </section>

      <section className="featured-section">
        <div className="section-shell">
          <div className="section-heading">
            <div><span className="eyebrow"><span className="eyebrow-line" /> HAND-PICKED FOR YOU</span><h2>Good books. <em>Big beginnings.</em></h2><p className="section-intro">A few thoughtful places to start your next chapter.</p></div>
            <Link className="button button--outline" to="/shop">Browse all books <ArrowRight size={16} /></Link>
          </div>
          <div className="book-grid">
            {featured.map((book, index) => <BookCard key={book.id} book={book} index={index} />)}
          </div>
        </div>
      </section>

      <section className="brand-story section-shell">
        <div className="story-ornament"><span>“</span></div>
        <div className="story-copy">
          <span className="eyebrow"><span className="eyebrow-line" /> MORE THAN A BOOKSHOP</span>
          <h2>Every great becoming<br />begins with <em>a little curiosity.</em></h2>
          <p>Maybe you’re building a business, changing a habit, finding your footing, or simply wondering what’s next. Wherever you are, there’s a book that can meet you there.</p>
          <Link className="text-link" to="/shop">Let’s find it together <ArrowRight size={15} /></Link>
        </div>
        <div className="story-stamp"><span>READ</span><BookOpen size={22} /><span>GROW</span></div>
      </section>
    </div>
  );
}
