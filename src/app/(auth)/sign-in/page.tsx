import { GoogleSignInButton } from "@/components/google-sign-in-button";

type SearchParams = Promise<{
  error?: string | string[];
  message?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const error = firstValue(query.error);
  const message = firstValue(query.message);

  return (
    <>
      <p className="text-sm font-bold tracking-[0.14em] text-[var(--verified-green)] uppercase">Welcome back</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[var(--source-teal)]">Sign in to StudySourced AI</h1>
      <p className="mt-3 text-base leading-7 text-[var(--muted)]">
        Access your private course sources, saved assessments, and tutor conversations.
      </p>

      {error ? (
        <p className="mt-5 rounded-md border border-[#b9452d]/30 bg-[#fff1ee] px-3 py-2 text-sm text-[#8f321f]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-5 rounded-md border border-[#2a9d8f]/30 bg-[#edf8f5] px-3 py-2 text-sm text-[#1f6f65]" role="status">
          {message}
        </p>
      ) : null}

      <GoogleSignInButton />

      <p className="mt-6 text-center text-sm text-[#565650]">
        New to StudySourced AI? Continue with Google to create your private workspace.
      </p>
    </>
  );
}
