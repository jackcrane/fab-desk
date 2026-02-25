import { authClient } from '../auth-client';
import { Page } from "../components/page";

export function HomeRoute({ navigate }) {
  const { data: session, isPending } = authClient.useSession();

  return (
    <Page title="Home" loading={isPending}>
      <main>
        <h1>Hello world</h1>
        <p>This is the public home route.</p>
        {session ? (
          <>
            <p>Signed in as {session.user.email}</p>
            <button type="button" onClick={() => navigate('/select-shop')}>
              Continue to shop selection
            </button>
          </>
        ) : null}
        {!session ? (
          <>
            <button type="button" onClick={() => navigate('/sign-in')}>
              Sign in
            </button>
            <button type="button" onClick={() => navigate('/sign-up')}>
              Sign up
            </button>
          </>
        ) : null}
      </main>
    </Page>
  );
}
