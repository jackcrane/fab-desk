import { useState } from 'react';
import { authClient } from '../auth-client';

export function SignUpRoute({ navigate }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await authClient.signUp.email({
      name,
      email,
      password,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? 'Unable to sign up');
      return;
    }

    navigate('/app', true);
  };

  return (
    <main>
      <h1>Hello world</h1>
      <p>Sign up</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="signup-name">Name</label>
        <input
          id="signup-name"
          type="text"
          value={name}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
          required
        />
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing up...' : 'Sign up'}
        </button>
      </form>
      {error ? <p>{error}</p> : null}
      <button type="button" onClick={() => navigate('/sign-in')}>
        Already have an account?
      </button>
    </main>
  );
}
