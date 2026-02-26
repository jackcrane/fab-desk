import { useEffect, useState } from "react";
import { Button, Card, Hatch, Input } from "@jackcrane/ui";
import { authClient } from "../../auth-client";
import { Flex } from "../../components/flex";
import { Page } from "../../components/page";
import { DitherMeshGradientFill } from "../../components/dither/dither";
import { isLikelyEmail, needsNameCompletion } from "../../lib/profile-name";
import style from "./CompleteProfileRoute.module.css";

export function CompleteProfileRoute({ navigate }) {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      navigate("/sign-in", true);
      return;
    }

    if (!needsNameCompletion(session.user)) {
      navigate("/shop", true);
    }
  }, [isPending, navigate, session]);

  if (!isPending && !session) {
    return null;
  }

  if (!isPending && session && !needsNameCompletion(session.user)) {
    return null;
  }

  const onSubmit = async () => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("Name is required");
      return;
    }

    if (isLikelyEmail(normalizedName)) {
      setError("Please enter your full name");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const result = await authClient.updateUser({
      name: normalizedName,
    });

    if (result.error) {
      setIsSubmitting(false);
      setError(result.error.message ?? "Unable to save your name");
      return;
    }

    await refetch();
    setIsSubmitting(false);
    navigate("/shop", true);
  };

  return (
    <Page title="Complete Profile" loading={isPending}>
      {!isPending ? (
        <main className={style.main}>
          <DitherMeshGradientFill />
          <Card title="Tell us your name" footerHeight={40}>
            <div className={style.form}>
              <p className={style.description}>
                Your SSO provider did not return a name. Enter your name to continue.
              </p>
              <form
                onSubmitCapture={(event) => {
                  event.preventDefault();
                }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void onSubmit();
                }}
              >
                <Flex gap={2}>
                  <Input
                    type="text"
                    value={name}
                    autoComplete="name"
                    onChange={(event) => setName(event.target.value)}
                    required
                    placeholder="John Smith"
                    label="Name"
                    disabled={isSubmitting}
                  />
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    variant="primary"
                    loading={isSubmitting}
                  >
                    {isSubmitting ? "Saving..." : "Continue"}
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
