import { ArrowRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BookCard from "../components/BookCard.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { discoveryGoals } from "../data/books.js";
import { useProducts } from "../context/ProductsContext.jsx";

export default function RecommendPage() {
  const { products, loading } = useProducts();
  const [searchParams] = useSearchParams();
  const [selectedGoal, setSelectedGoal] = useState(searchParams.get("goal") ?? "");
  const goal = discoveryGoals.find((item) => item.label === selectedGoal);
  const recommendations = useMemo(() => {
    if (!goal) return [];
    return products
      .map((book) => ({ book, score: (book.tags ?? []).filter((tag) => goal.tags.includes(tag)).length }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((result) => result.book);
  }, [goal, products]);

  if (loading) return <LoadingState message="Finding a few good places to start…" />;

  return (
    <div className="recommend-page section-shell">
      <div className="recommend-intro">
        <span className="recommend-symbol"><Sparkles size={20} /></span>
        <span className="eyebrow"><span className="eyebrow-line" /> A MORE PERSONAL WAY TO DISCOVER</span>
        <h1>What would you like<br />to <em>grow into?</em></h1>
        <p>Choose what’s on your mind. We’ll point you toward a few books that might help.</p>
      </div>
      <div className="recommend-goals">
        {discoveryGoals.map((item, index) => (
          <button className={`recommend-goal ${selectedGoal === item.label ? "recommend-goal--selected" : ""}`} key={item.label} onClick={() => setSelectedGoal(item.label)}>
            <span className="recommend-goal__icon">{item.icon}</span><span>{item.label}</span><span className="recommend-goal__index">0{index + 1}</span>
          </button>
        ))}
      </div>
      {goal && <section className="recommend-results">
        <div className="recommend-result-heading"><div><span className="eyebrow">A FEW PLACES TO START</span><h2>For your journey towards <em>{goal.label.toLowerCase()}.</em></h2></div><span className="match-note"><Sparkles size={14} /> Matched to your interests</span></div>
        {recommendations.length ? <div className="book-grid">{recommendations.map((book, index) => <BookCard key={book.id} book={book} index={index} />)}</div> : <p className="recommend-empty">We’re still adding books for this path. Browse the shop to explore everything available.</p>}
      </section>}
      {!goal && <p className="recommend-hint">Choose a path above and we’ll make a few suggestions. <ArrowRight size={15} /></p>}
      <p className="recommend-disclaimer">Suggestions are based on book categories and tags — a little direction, not a definitive answer.</p>
    </div>
  );
}
