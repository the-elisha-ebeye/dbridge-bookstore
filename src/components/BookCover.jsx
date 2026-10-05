import { useState } from "react";

export default function BookCover({ book, className = "" }) {
  const [failedImage, setFailedImage] = useState("");
  const tone = book?.cover ?? "cream";
  const showImage = book.image_url && failedImage !== book.image_url;

  return (
    <div className={`book-cover book-cover--${tone} ${className}`} aria-label={`${showImage ? "Cover" : "Illustrated cover"} for ${book.title}`}>
      {showImage ? (
        <img className="book-cover__image" src={book.image_url} alt={`Cover of ${book.title}`} onError={() => setFailedImage(book.image_url)} />
      ) : (
        <div className="cover-frame">
          <span className="cover-mark">D’B</span>
          <span className="cover-rule" />
          <span className="cover-title">{book.title}</span>
          <span className="cover-author">{book.author}</span>
          <span className="cover-edition">D’BRIDGE BOOKSHOP · READING EDITION</span>
        </div>
      )}
    </div>
  );
}
