import { useState } from 'react';
import { authClient } from '../auth-client';

export function SignInRoute({ navigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await authClient.signIn.email({
      email,
      password,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? 'Unable to sign in');
      return;
    }

    navigate('/app', true);
  };

  return (
    <main>
      <h1>Hello world</h1>
      <p>Sign in</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="signin-email">Email</label>
        <input
          id="signin-email"
          type="email"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="signin-password">Password</label>
        <input
          id="signin-password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      {error ? <p>{error}</p> : null}
      <button type="button" onClick={() => navigate('/sign-up')}>
        Need an account?
      </button>
    </main>
  );
}
