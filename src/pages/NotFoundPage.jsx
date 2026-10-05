import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return <div className="not-found"><span className="eyebrow">A PAGE TURNED TOO FAR</span><h1>This page is still being written.</h1><p>Let’s take you back to the bookshelves.</p><Link to="/" className="button button--primary"><ArrowLeft size={16} /> Return home</Link></div>;
}
