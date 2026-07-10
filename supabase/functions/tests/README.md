# Integration tests

Κάθε `<name>.integration_test.ts` σηκώνει την αντίστοιχη function (το πραγματικό
`index.ts`, αναλλοίωτο) ως subprocess με `deno run`, με το `SUPABASE_URL` να
δείχνει σε in-memory mock του Supabase stack (`helpers/mock_supabase.ts`:
GoTrue `/auth/v1/user` + PostgREST `/rest/v1/*` με eq/in filters, FK emulation
και one-shot error injection). Δεν χρειάζεται Docker ούτε `supabase start`.

## Εκτέλεση

```powershell
deno test -A supabase/functions/tests/
```

Χρειάζεται `-A` (ή τουλάχιστον `--allow-net --allow-env --allow-run --allow-read`):
το `--allow-run` για το spawn της function, το `--allow-net` για τα HTTP requests.

Οι functions ακούν όλες στο port 8000 (default των `Deno.serve`/`serve`), οπότε
τα test files τρέχουν σειριακά — μην προσθέσεις `--parallel`.

## Συμβάσεις

- Tenants/tokens fixtures στο `helpers/harness.ts` (`TENANT_A/B`, `TOKEN_A/B`,
  `TOKEN_NO_TENANT`).
- `assertOkEnvelope` / `assertFailEnvelope` επιβάλλουν το response envelope
  (`{ok:true,data}` / `{ok:false,error:{code,message}}`).
- `mock.db.failNext(table, op, {...})` προσομοιώνει αποτυχία DB για το επόμενο
  matching request — έτσι ασκούνται τα DB-error branches.
- FK contract: παραβίαση foreign key σε delete → `409 CONFLICT`. Λοιπά DB
  errors σε delete → `400 DB_DELETE_FAILED`.

## Όρια του mock

Το mock δεν είναι Postgres: δεν ελέγχει NOT NULL/UNIQUE/τύπους, δεν τρέχει RLS
και δεν κάνει transactions. Ό,τι εξαρτάται από πραγματικό σχήμα βάσης θέλει
έλεγχο σε πραγματικό stack (`supabase start`) όταν υπάρξει Docker + migrations.
