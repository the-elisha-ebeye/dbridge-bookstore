import { ArrowUpRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <Link className="brand brand--footer" to="/">
            <span className="brand-mark"><BookOpen size={19} /></span>
            <span className="brand-name">D’Bridge<span>Bookshop</span></span>
          </Link>
          <p>Connecting minds to the right books.</p>
          <span className="footer-location">Benin City, Edo State, Nigeria</span>
        </div>
        <div className="footer-links">
          <span className="footer-heading">Explore</span>
          <Link to="/shop">All books <ArrowUpRight size={13} /></Link>
          <Link to="/recommend">Find your next read <ArrowUpRight size={13} /></Link>
          <Link to="/cart">Your book bag <ArrowUpRight size={13} /></Link>
        </div>
        <div className="footer-note">
          <span className="footer-heading">A note from us</span>
          <p>Every good story starts somewhere. We’re here to help you find yours.</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} D’Bridge Bookshop</span>
        <span>Thoughtful reads. Meaningful growth.</span>
      </div>
    </footer>
  );
}
