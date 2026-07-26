# Supabase migrations

The migrations in this folder define the AI Study Website database schema and
privacy policies. They are committed to Git so the deployed database can be
recreated and reviewed consistently.

## Apply migrations

1. In the Supabase Dashboard, open **SQL Editor**.
2. Create a new query.
3. Apply each migration in filename order, starting with
   `migrations/0001_initial_schema.sql`.
4. Copy one complete migration into the query editor, click **Run**, and confirm
   that it completes successfully before applying the next one.

The first migration creates the initial app tables, enables Row Level Security,
and creates the private `course-materials` storage bucket policy. The second
migration makes parsed source material and document-processing status
server-managed. The third migration narrows document and Storage write rules so
an upload must match a private document record owned by the same user. The
fourth migration adds atomic, server-only processing functions for extracted
source text. None of these migrations makes an uploaded file or database row
public.

`0004_secure_document_ingestion.sql` replaces one weaker foreign-key constraint
with a stronger same-document constraint. The SQL Editor may flag that as a
destructive operation because it drops and recreates the constraint; it does
not remove documents, original files, or source text.

Do not manually edit the `storage` schema. Use the Storage API in application
code to upload, move, or delete files.

## Configure server-only source processing

The parser needs a Supabase **secret key** to download a verified private file
and atomically store its parsed sections. This key bypasses RLS, so it is kept
only on the Next.js server after the user has been authorized with their normal
session.

1. In Supabase, open **Settings** > **API Keys**.
2. Copy a value from **Secret keys** (it begins with `sb_secret_`). Do not use
   the publishable key for this step.
3. In the local, git-ignored `.env.local` file, add this line with your actual
   value:

   ```bash
   SUPABASE_SECRET_KEY=your_secret_key_here
   ```

4. Never paste that value into chat, commit it, or put it in a variable starting
   with `NEXT_PUBLIC_`.
5. Restart `npm run dev` after changing `.env.local`.

For an older Supabase project without a Secret keys section, the app also
accepts the legacy `SUPABASE_SERVICE_ROLE_KEY` locally. Prefer a new secret key
when one is available.

The current pre-alpha parser runs synchronously after upload and is capped at
20 MB, 250 PDF pages, 500,000 extracted characters, and 350 source passages.
Before production deployment, move the same processing logic into a durable
background job so a hosted request does not need to wait for parsing.

## Verify the private material bucket

Open **Storage** > **course-materials** in the Supabase Dashboard and confirm
that the bucket remains private. Its file limit should be **20 MB**, and its
allowed MIME types should be exactly:

- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `text/plain`

The first migration only creates this configuration if the bucket does not
already exist, so this check is important when the bucket was first created in
the Dashboard.

## Email-confirmation modes

New free-tier Supabase projects using Supabase's default email service cannot
edit Auth email templates. Choose the mode that fits the stage of the project.

### Local development

While testing only on your own computer, open **Authentication** > **Providers**
> **Email** and turn **Confirm email** off. The app will create a session
immediately and take a new account to its private dashboard. Turn confirmation
back on before the app is available to outside testers.

### Pre-alpha and production

Before people outside the Supabase project team create accounts, configure a
custom SMTP provider in Supabase. It both enables editable templates and allows
reliable delivery to external email addresses. Then configure the **Confirm
signup** template's confirmation link as follows:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">
  Confirm your email address
</a>
```

This sends the one-time token to the app's confirmation endpoint, which
exchanges it for a secure session cookie and then sends the user to the
dashboard.
