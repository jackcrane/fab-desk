export function NotFoundRoute({ navigate }) {
  return (
    <main>
      <h1>Hello world</h1>
      <p>Route not found.</p>
      <button type="button" onClick={() => navigate('/')}>
        Go home
      </button>
    </main>
  );
}
