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
server-managed. Neither migration makes an uploaded file or database row public.

Do not manually edit the `storage` schema. Use the Storage API in application
code to upload, move, or delete files.

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
