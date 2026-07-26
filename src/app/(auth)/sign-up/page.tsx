import Link from "next/link";

import { signUp } from "../actions";

type SearchParams = Promise<{
  error?: string | string[];
  message?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const error = firstValue(query.error);
  const message = firstValue(query.message);

  return (
    <>
      <p className="text-sm font-semibold tracking-[0.14em] text-[#264653] uppercase">Get started</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create your private workspace</h1>
      <p className="mt-3 text-sm leading-6 text-[#565650]">
        Your course materials and generated work stay private unless you explicitly share them later.
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

      <form action={signUp} className="mt-7 space-y-5">
        <label className="block text-sm font-semibold" htmlFor="displayName">
          Name
          <input
            className="mt-2 w-full rounded-md border border-black/20 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-[#264653] focus:ring-2 focus:ring-[#264653]/15"
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            maxLength={120}
            required
          />
        </label>
        <label className="block text-sm font-semibold" htmlFor="email">
          Email address
          <input
            className="mt-2 w-full rounded-md border border-black/20 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-[#264653] focus:ring-2 focus:ring-[#264653]/15"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="block text-sm font-semibold" htmlFor="password">
          Password
          <input
            className="mt-2 w-full rounded-md border border-black/20 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-[#264653] focus:ring-2 focus:ring-[#264653]/15"
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <span className="mt-1 block font-normal text-[#6b6b67]">Use at least 8 characters.</span>
        </label>
        <button
          className="w-full rounded-md bg-[#264653] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d3741] focus:outline-none focus:ring-2 focus:ring-[#264653] focus:ring-offset-2"
          type="submit"
        >
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#565650]">
        Already have an account?{" "}
        <Link className="font-semibold text-[#264653] underline underline-offset-4" href="/sign-in">
          Sign in
        </Link>
      </p>
    </>
  );
}
