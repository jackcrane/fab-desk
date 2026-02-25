import { useEffect, useState } from 'react';
import { authClient } from '../auth-client';
import { Page } from "../components/page";

export function ProtectedAppRoute({ navigate }) {
  const { data: session, isPending } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      navigate('/sign-in', true);
    }
  }, [isPending, navigate, session]);

  if (isPending) {
    return (
      <Page title="App">
        <main>
          <h1>Hello world</h1>
          <p>Checking auth...</p>
        </main>
      </Page>
    );
  }

  if (!session) {
    return null;
  }

  const onSignOut = async () => {
    setIsSigningOut(true);
    await authClient.signOut();
    setIsSigningOut(false);
    navigate('/sign-in', true);
  };

  return (
    <Page title="App">
      <main>
        <h1>Hello world</h1>
        <p>Protected route: /app</p>
        <p>Signed in as {session.user.email}</p>
        <button type="button" onClick={onSignOut} disabled={isSigningOut}>
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </button>
      </main>
    </Page>
  );
}
