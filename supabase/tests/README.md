# Security test checklist

The app's privacy rests entirely on Row Level Security: the phone talks straight
to the database, so the database itself has to refuse anything it should not
allow. These checks prove it does.

## How to run

From the project folder, against the linked project:

```
supabase db query --linked -f supabase/tests/rls_test.sql
```

Or paste the file into the Supabase dashboard → **SQL Editor** → **New query** → **Run**.

It creates three throwaway users (A, B and C), makes A and B accepted friends,
leaves A's request to C pending, then tries every read and write from each of
their points of view. It deletes the throwaway users at the end.

Every row of the result table should say **PASS**.

Afterwards you can drop the results table:

```sql
drop table public.rls_test_results;
```

## What is checked

| # | Check | Why it matters |
|---|---|---|
| 1 | A reads own cards | The basics still work |
| 2 | A reads accepted friend B's cards | Friends can view each other |
| 3 | A cannot read C's cards (request pending) | **A pending request grants nothing** |
| 4 | A cannot insert into B's portfolio | Friendship is read-only |
| 5 | A cannot change B's cards | Friendship is read-only |
| 6 | A cannot delete B's cards | Friendship is read-only |
| 7 | A sees only their own profile row | No browsing the user list |
| 8 | A can look up an exact username | Needed to send friend requests |
| 9 | A partial username reveals nobody | No fishing for names |
| 10 | Friend list holds only accepted friends | Pending stays private |
| 11 | The requester cannot accept their own request | Only the addressee accepts |
| 12 | A can read shared card data | Prices are shared |
| 13 | A cannot rewrite card prices | Only Edge Functions write prices |
| 14 | A cannot reset their own scan count | The daily limit cannot be dodged |
| 15 | C gets nothing from A while pending | Checked from the other side too |
| 16 | C has no friends while pending | Checked from the other side too |
| 17 | C does see the incoming request | Requests still arrive |
| 18 | Signed-out visitor gets no cards | Nothing is public |
| 19 | Signed-out visitor gets no profiles | Nothing is public |
| 20 | Signed-out visitor gets no card data | Nothing is public |
| 21 | Two people cannot share a username | Usernames identify people |
| 22 | Username format enforced in the database | Not only in the app |

### A note on checks 18–20

Signed-out visitors are blocked twice over: they hold no privileges on these
tables *and* no policy would match them. Postgres therefore refuses the query
outright rather than returning an empty list, and the test treats both as a pass.

If Postgres ever suggests `GRANT SELECT ... TO anon` to make an error go away,
do not do it. That removes the first of those two layers.

## Also checked live, from the browser

Run against the real project with two real accounts signed in through the app:

- A second signed-in account reading `profiles`, `portfolio_items`,
  `friendships` and `usage_counters` got back empty lists, not other people's rows.
- Creating a profile row belonging to somebody else was refused
  (`42501 new row violates row-level security policy`).
- Writing to `cards_cache` and `usage_counters` was refused (no insert privilege).
- Claiming a username somebody already has was refused by the unique constraint,
  and the app showed "That username is taken."
