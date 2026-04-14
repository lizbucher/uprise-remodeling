# GSC Search Analytics — Setup

Populates the **Search Console** tab in the admin dashboard with clicks, impressions, CTR, avg position, top queries, and top landing pages.

## One-time setup

You only do this once. After that the dashboard pulls live data on every visit.

### 1. Reuse the same service account from sitemap auto-submit
If you already set up `GSC_SERVICE_ACCOUNT_JSON` for the GitHub Action, you can use the **same service account**. It already has Owner access to the GSC property.

If you haven't done that yet, follow steps 1–3 in `scripts/README.md` (create service account, add to GSC as Owner).

### 2. Store the service account key in Supabase secrets
```bash
supabase secrets set GSC_SERVICE_ACCOUNT_JSON="$(cat path/to/service-account.json)" --project-ref pmxrjlxfppjpwnrpqmjj
```
Or via the Supabase dashboard: Project → Settings → Edge Functions → Secrets → add `GSC_SERVICE_ACCOUNT_JSON`.

### 3. Deploy the edge function
```bash
supabase functions deploy gsc-search-analytics --project-ref pmxrjlxfppjpwnrpqmjj
```

### 4. Test
Open the admin dashboard → click **Search Console** in the sidebar. Data should appear.

## Notes

- GSC reports data on a ~2-day delay (normal — Google needs time to aggregate)
- A brand-new property will show empty data for the first ~1 week
- Date range selector supports 7 / 28 / 90 day ranges
- Property is hardcoded to `sc-domain:upriseremodeling.com` (domain property)
