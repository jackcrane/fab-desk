import { useEffect, useState } from "react";
import { authClient, checkDomainForSso } from "../../auth-client";
import { Button, Card, Hatch, Input } from "@jackcrane/ui";
import style from "./SignInRoute.module.css";
import { Flex } from "../../components/flex";
import { Page } from "../../components/page";
import { DitherMeshGradientFill } from "../../components/dither/dither";

export function SignInRoute({ navigate }) {
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState("email");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDomain, setIsCheckingDomain] = useState(false);

  useEffect(() => {
    if (!isPending && session) {
      navigate("/shop", true);
    }
  }, [isPending, navigate, session]);

  if (!isPending && session) {
    return null;
  }

  const onContinue = async () => {
    setError("");
    setIsCheckingDomain(true);

    try {
      const result = await checkDomainForSso(email.trim());

      if (result.requiresSso) {
        setError(`Single sign-on is required for ${result.domain}`);
        return;
      }

      setStep("password");
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Unable to check domain");
    } finally {
      setIsCheckingDomain(false);
    }
  };

  const onSignIn = async () => {
    setError("");
    setIsSubmitting(true);

    const result = await authClient.signIn.email({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Unable to sign in");
      return;
    }

    navigate("/shop", true);
  };

  return (
    <Page title="Sign In" loading={isPending}>
      {!isPending ? (
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
              <form
                onSubmitCapture={(event) => {
                  event.preventDefault();
                }}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (step === "email") {
                    void onContinue();
                    return;
                  }

                  void onSignIn();
                }}
              >
                <Flex gap={2}>
                  <Input
                    type="email"
                    value={email}
                    autoComplete="email"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="you@example.com"
                    label="Email"
                    disabled={isCheckingDomain || isSubmitting || step === "password"}
                  />
                  {step === "password" ? (
                    <Input
                      type="password"
                      value={password}
                      autoComplete="current-password"
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      placeholder="••••••••"
                      label="Password"
                    />
                  ) : null}
                  <div className={style.actions}>
                    {step === "password" ? (
                      <Button
                        type="button"
                        onClick={() => {
                          setStep("email");
                          setPassword("");
                          setError("");
                        }}
                      >
                        Use different email
                      </Button>
                    ) : null}
                    <Button
                      type="submit"
                      disabled={isSubmitting || isCheckingDomain}
                      variant="primary"
                      loading={isSubmitting || isCheckingDomain}
                    >
                      {step === "password"
                        ? isSubmitting
                          ? "Signing in..."
                          : "Sign in"
                        : isCheckingDomain
                          ? "Checking..."
                          : "Continue"}
                    </Button>
                  </div>
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
