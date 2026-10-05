import { Outlet } from "react-router-dom";
import SiteFooter from "./SiteFooter.jsx";
import SiteHeader from "./SiteHeader.jsx";

export default function StoreLayout() {
  return (
    <>
      <div className="announcement"><span className="announcement-dot" /> New perspectives begin with the right book <span className="announcement-separator">✳</span> Thoughtfully chosen in Benin City</div>
      <SiteHeader />
      <main><Outlet /></main>
      <SiteFooter />
    </>
  );
}
