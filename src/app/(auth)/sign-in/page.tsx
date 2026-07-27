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
      <p className="text-sm font-semibold tracking-[0.14em] text-[#264653] uppercase">Welcome back</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to your workspace</h1>
      <p className="mt-3 text-sm leading-6 text-[#565650]">
        Use your Google account to access your private course materials, saved
        assessments, and tutor conversations.
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
        New to AI Study? Continue with Google to create your private workspace.
      </p>
    </>
  );
}
