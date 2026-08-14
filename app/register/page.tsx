import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth";
import { getViewer } from "@/lib/auth";
import { isKeysStoreRequest } from "@/lib/site-mode";
import { storeAccountDestination } from "@/lib/account-routing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create an account" };

export default async function RegisterPage() {
  if (!(await isKeysStoreRequest())) redirect(new URL("/register", storeAccountDestination("/")).toString());
  const viewer = await getViewer();
  if (viewer.profile?.status === "active") redirect("/");

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-icon">U</div>
        <p className="eyebrow">UniPlug account</p>
        <h1>Create your account</h1>
        <p>Register to keep your UniPlug shop account ready for purchases and support.</p>
        <RegisterForm />
        <small>Already registered? <Link href="/login">Sign in</Link>.</small>
      </div>
    </section>
  );
}
