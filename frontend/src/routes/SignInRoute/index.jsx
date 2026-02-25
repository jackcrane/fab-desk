import { useEffect, useState } from "react";
import { authClient } from "../../auth-client";
import { Button, Card, Hatch, Input } from "@jackcrane/ui";
import style from "./SignInRoute.module.css";
import { Flex } from "../../components/flex";
import DitherMeshGradient, {
  DitherMeshGradientFill,
} from "../../components/dither/dither";

export function SignInRoute({ navigate }) {
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isPending && session) {
      navigate("/app", true);
    }
  }, [isPending, navigate, session]);

  if (isPending || session) {
    return null;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await authClient.signIn.email({
      email,
      password,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Unable to sign in");
      return;
    }

    navigate("/app", true);
  };

  return (
    <main className={style.main}>
      <DitherMeshGradientFill />
      <Card
        title="Sign In"
        footer={
          <Button type="button" onClick={() => navigate("/sign-up")}>
            Need an account?
          </Button>
        }
        footerHeight={40}
      >
        <div className={style.form}>
          <form onSubmit={onSubmit}>
            <Flex gap={2}>
              <Input
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@example.com"
                label="Email"
              />
              <Input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="••••••••"
                label="Password"
              />
              <Button
                type="submit"
                disabled={isSubmitting}
                variant="primary"
                loading={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
              {error ? (
                <Hatch variant="danger" footerHeight={12}>
                  {error}
                </Hatch>
              ) : null}
            </Flex>
          </form>
        </div>
      </Card>
    </main>
  );
}
