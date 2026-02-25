import { Page } from "../components/page";

export function NotFoundRoute({ navigate }) {
  return (
    <Page title="Not Found">
      <main>
        <h1>Hello world</h1>
        <p>Route not found.</p>
        <button type="button" onClick={() => navigate('/')}>
          Go home
        </button>
      </main>
    </Page>
  );
}
