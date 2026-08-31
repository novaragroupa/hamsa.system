# create-employee Edge Function

Deploy with Supabase CLI:

supabase functions deploy create-employee

The function uses the built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
secrets available to Supabase Edge Functions. Never put the service role key in
GitHub or `index.html`.

The frontend calls this function with the logged-in user's access token.
Only profiles whose role is `admin` or `hr` and whose status is `active` can
create employee accounts.
