import { BookOpen, ChevronDown, Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { itemCount } = useCart();
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" onClick={closeMenu} aria-label="D’Bridge Bookshop home">
          <span className="brand-mark"><BookOpen size={19} strokeWidth={1.8} /></span>
          <span className="brand-name">D’Bridge<span>Bookshop</span></span>
        </Link>
        <button
          className="mobile-menu-toggle"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={`main-nav ${menuOpen ? "main-nav--open" : ""}`}>
          <NavLink to="/" onClick={closeMenu} end>Home</NavLink>
          <NavLink to="/shop" onClick={closeMenu}>Shop</NavLink>
          <NavLink to="/recommend" onClick={closeMenu}>Find your book</NavLink>
          <Link className="nav-category" to="/shop#categories" onClick={closeMenu}>
            Categories <ChevronDown size={14} />
          </Link>
        </nav>
        <div className="header-actions">
          <Link className="account-link" to="/orders">My account</Link>
          <Link className="cart-link" to="/cart" aria-label={`Shopping bag, ${itemCount} items`}>
            <ShoppingBag size={19} strokeWidth={1.7} />
            <span>Bag</span>
            {itemCount > 0 && <span className="cart-count">{itemCount}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}
