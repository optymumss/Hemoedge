# Cloudflare Workers deployment — blocked

This branch holds placeholder config for deploying HemoEdge to Cloudflare
Workers via the [OpenNext adapter](https://opennext.js.org/cloudflare), as
an addition alongside the existing Vercel deployment. **It does not build.**

## The blocker

```
npm error Could not resolve dependency:
npm error peer next@">=15.5.21 <16 || >=16.2.11" from @opennextjs/cloudflare@1.20.2
npm error Found: next@16.2.10
```

`@opennextjs/cloudflare` refuses to install against `next@16.2.10` — the
version pinned in `package.json`. Its peer range covers `<16` or
`>=16.2.11`, and `16.2.10` falls in a gap it deliberately excludes.

This project runs a **customized Next.js fork** (see `AGENTS.md`: *"This is
NOT the Next.js you know"*), not the standard package, so bumping the
version number isn't something to do casually — there's no guarantee a
`16.2.11` of this fork exists, or that it resolves whatever OpenNext is
protecting against. Forcing the install past the peer-dependency check
(`--legacy-peer-deps`) would run the adapter against a Next.js version its
own authors said not to support, with no guarantee it produces a working
build.

## What's here

- `wrangler.jsonc` — Workers config (name, compatibility date/flags, static
  assets binding). Untested.
- `open-next.config.ts` — minimal OpenNext config using the adapter's
  default settings. Imports a package that isn't installed on this branch,
  so `npx tsc --noEmit` will fail here — that's expected, not a bug to fix.

## What would need to happen to unblock this

1. A release of this Next.js fork that satisfies OpenNext's peer range
   (`>=16.2.11`, or whatever range a future OpenNext version supports), **or**
2. Confirmation that downgrading to a non-forked Next.js version (giving up
   whatever this fork's changes provide) is an acceptable trade-off — a much
   bigger decision than a Cloudflare config change and out of scope for this
   branch.

Once either is true, the remaining setup is: `npm install
@opennextjs/cloudflare wrangler`, add the `preview`/`deploy`/`cf-typegen`
scripts from Cloudflare's Next.js guide to `package.json`, duplicate all app
secrets (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
`STRIPE_SECRET_KEY`, `RESEND_API_KEY`, etc.) into Cloudflare, and validate
Server Actions specifically against the `preview` command (real `workerd`
runtime, not `next dev`) before treating this as a real parallel production
deployment alongside Vercel.
