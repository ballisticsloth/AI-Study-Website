# Supabase migrations

The migrations in this folder define the AI Study Website database schema and
privacy policies. They are committed to Git so the deployed database can be
recreated and reviewed consistently.

## Push migrations from the terminal

The project uses the official Supabase CLI as a development dependency. Once it
has been linked to the hosted project, use these commands from the project root:

```bash
# Create the next timestamped migration file, then edit its SQL.
npm run supabase:migration:new -- describe_your_change

# Review the pending database changes without applying them.
npm run supabase:migration:check

# Apply pending migrations to the linked Supabase project.
npm run supabase:push
```

`npm run supabase:push` is the everyday shortcut. It applies only migration
files that have not already been recorded in Supabase's remote migration
history. Always run the check command first for a meaningful schema change,
then test the app and commit the new migration file with its related code.

The one-time CLI bootstrap is intentionally separate: link the project, record
the migrations that were previously applied manually, and verify that the local
and remote histories match. Do not run `supabase db reset --linked`; it deletes
the linked project's data.

### One-time bootstrap for this existing project

The first four migrations were already applied through the Dashboard before the
CLI was added. After `npm run supabase:link` has linked the correct project,
mark these known-good migrations as applied **once**. This updates only the
CLI's migration history; it does not run their SQL a second time.

```bash
npx supabase migration repair --linked --status applied 20260726150000
npx supabase migration repair --linked --status applied 20260726150100
npx supabase migration repair --linked --status applied 20260726192500
npx supabase migration repair --linked --status applied 20260726204900

npm run supabase:migration:list
```

Only do this after confirming the remote project is the one used by this app
and the existing upload/source-processing tests have passed. The final list
should show the same four timestamps locally and remotely.

The first migration creates the initial app tables, enables Row Level Security,
and creates the private `course-materials` storage bucket policy. The second
migration makes parsed source material and document-processing status
server-managed. The third migration narrows document and Storage write rules so
an upload must match a private document record owned by the same user. The
fourth migration adds atomic, server-only processing functions for extracted
source text. None of these migrations makes an uploaded file or database row
public.

`20260726204900_secure_document_ingestion.sql` replaces one weaker foreign-key constraint
with a stronger same-document constraint. The SQL Editor may flag that as a
destructive operation because it drops and recreates the constraint; it does
not remove documents, original files, or source text.

After the one-time CLI bootstrap, do not apply future schema changes through the
Dashboard SQL Editor or Table Editor. Create a migration file locally and push
it through the CLI instead. Use the Storage API in application code to upload,
move, or delete files.

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
