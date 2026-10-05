export default function LoadingState({ message = "Finding the right reads…" }) {
  return <div className="loading-state"><span className="loading-spinner" />{message}</div>;
}
