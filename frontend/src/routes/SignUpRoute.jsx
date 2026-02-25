import { useEffect, useState } from "react";
import { authClient } from "../auth-client";
import { Button, Card, Hatch, Input } from "@jackcrane/ui";
import { Flex } from "../components/flex";
import { Page } from "../components/page";
import { DitherMeshGradientFill } from "../components/dither/dither";
import style from "./SignUpRoute.module.css";

export function SignUpRoute({ navigate }) {
  const { data: session, isPending } = authClient.useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isPending && session) {
      navigate("/select-shop", true);
    }
  }, [isPending, navigate, session]);

  if (!isPending && session) {
    return null;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await authClient.signUp.email({
      name,
      email,
      password,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Unable to sign up");
      return;
    }

    navigate("/select-shop", true);
  };

  return (
    <Page title="Sign Up" loading={isPending}>
      {!isPending ? (
        <main className={style.main}>
          <DitherMeshGradientFill />
          <Card
            title="Sign Up"
            footer={
              <Button type="button" onClick={() => navigate("/sign-in")}>
                Already have an account?
              </Button>
            }
            footerHeight={40}
          >
            <div className={style.form}>
              <form onSubmit={onSubmit}>
                <Flex gap={2}>
                  <Input
                    type="text"
                    value={name}
                    autoComplete="name"
                    onChange={(event) => setName(event.target.value)}
                    required
                    placeholder="John Smith"
                    label="Name"
                  />
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
                    autoComplete="new-password"
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
                    {isSubmitting ? "Signing up..." : "Sign up"}
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
      ) : null}
    </Page>
  );
}
