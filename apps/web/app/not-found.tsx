export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="text-gray-400">The page you are looking for does not exist.</p>
      <a
        href="/"
        className="rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200"
      >
        Go home
      </a>
    </div>
  );
}
