# Cloudflare Workers deployment — blocked

This branch holds config for deploying HemoEdge to Cloudflare Workers via
the [OpenNext adapter](https://opennext.js.org/cloudflare), as an addition
alongside the existing Vercel deployment. **It does not build.**

## Blocker #1 (resolved): peer dependency gap

The original blocker was that `@opennextjs/cloudflare@1.20.2` requires
`next@">=15.5.21 <16 || >=16.2.11"`, and this project pinned `next@16.2.10`
— a version in the gap that range deliberately excludes.

This is now fixed: `next` and `eslint-config-next` are bumped to `16.2.12`,
a real published patch release (confirmed via the npm registry) that
satisfies OpenNext's peer range. This is a two-patch-version bump within
the same 16.x line, not the fork-abandoning downgrade the original note
speculated might be necessary. `npm install`, `npx tsc --noEmit`, and
`next build` all pass cleanly on this version.

## Blocker #2 (current, unresolved): Node.js Proxy vs. Workers runtime

Running the actual Cloudflare build (`npx opennextjs-cloudflare build`)
fails with:

```
ERROR Node.js middleware is not currently supported. Consider switching to Edge Middleware.
```

This project's Next.js fork renamed `middleware.ts` to `src/proxy.ts` (see
`AGENTS.md`) and, as of this fork's v16, **Proxy is Node.js-runtime-only** —
confirmed by testing `runtime: "edge"` in `proxy.ts`'s `config` export,
which fails the build with `Proxy does not support Edge runtime`. There is
no way to opt back into Edge runtime for Proxy in this version.

`@opennextjs/cloudflare` (latest published, `1.20.2`) has no support for
Node.js middleware yet and aborts the build the moment it detects one.
`src/proxy.ts` does real, security-relevant work — Supabase session refresh
and role-based auth gating for every `/admin`, `/app`, and `/org` route —
so it can't just be deleted to unblock the build.

This is a known, currently unresolved ecosystem-wide gap, not something
specific to this repo:

- Cloudflare's tracker documents the same "version trap":
  [cloudflare/workers-sdk#13755](https://github.com/cloudflare/workers-sdk/issues/13755) —
  status unresolved, no pinned version combination avoids it.
- OpenNext's Cloudflare adapter has active, unmerged work on this:
  [opennextjs-cloudflare#1309](https://github.com/opennextjs/opennextjs-cloudflare/pull/1309)
  ("support Node.js middleware (proxy.ts)") and
  [#1275](https://github.com/opennextjs/opennextjs-cloudflare/pull/1275)
  ("support Workers-compatible Node middleware") are both still open; two
  earlier attempts were abandoned
  ([#1308](https://github.com/opennextjs/opennextjs-cloudflare/pull/1308),
  [#1280](https://github.com/opennextjs/opennextjs-cloudflare/pull/1280)).
  Root issue:
  [#1277](https://github.com/opennextjs/opennextjs-cloudflare/issues/1277)
  ("No support for `proxy.js` in Cloudflare Workers").
- No published `@opennextjs/cloudflare` release contains this support yet.

## What's here

- `wrangler.jsonc` — Workers config (name, compatibility date/flags, static
  assets binding). Untested (build doesn't reach the point of producing a
  worker bundle).
- `open-next.config.ts` — minimal OpenNext config using the adapter's
  default settings.
- `package.json` — `@opennextjs/cloudflare` and `wrangler` as
  devDependencies, plus `preview`/`deploy`/`cf-typegen` scripts, per
  Cloudflare's Next.js guide.

## What would need to happen to unblock this

1. `@opennextjs/cloudflare` ships Node.js middleware support (tracked in
   the PRs above), **or**
2. The auth/session logic in `src/proxy.ts` is refactored out of Proxy
   entirely — moved into per-surface server-side checks in the
   `/admin`, `/app`, and `/org` layouts instead of a single edge/node
   gate. This is a security-relevant change that needs careful review, not
   a quick patch, and is out of scope for this branch.

Once either is true, remaining setup: duplicate all app secrets
(`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`,
`RESEND_API_KEY`, etc.) into Cloudflare, and validate Server Actions
specifically against the `preview` command (real `workerd` runtime, not
`next dev`) before treating this as a real parallel production deployment
alongside Vercel.
