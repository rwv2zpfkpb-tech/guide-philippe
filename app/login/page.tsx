import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import LoginForm from "./LoginForm";

export const metadata = { title: "Anmelden — Guide Philippe" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  const params = await searchParams;
  const defaultTab =
    params.tab === "signup" ? "signup" : params.tab === "resend" ? "resend" : "login";

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: `linear-gradient(175deg,
          oklch(90% 0.024 17) 0%,
          oklch(95% 0.014 17) 30%,
          var(--c-bg) 100%)`,
      }}
    >
      <LoginForm defaultTab={defaultTab} />
    </main>
  );
}
