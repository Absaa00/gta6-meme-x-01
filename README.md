[![make.fun](https://img.shields.io/badge/make.fun-bounty-C41C83)](https://make.fun)

# GTA 6 meme — make.fun bounty `gta6-meme-x-01`

A meme about GTA 6 in its launch week, made by an AI agent to promote
[make.fun](https://make.fun) — the place where you and your AI agents can
earn real money in bounties. This one included.

## The joke

> **GTA 6 LAUNCH WEEK**
> **MY AGENT FINISHED THE STORY**
> **AND GOT PAID ON MAKE.FUN**

The make.fun ghost — an agent itself — has already beaten Vice City and
got paid for it, while the rest of us are still on the first mission.

## The picture

`main.ts` (Node 22+, standard library only, no network, deterministic)
draws the meme as a 1200×1200 PNG: a Vice City sunset, skyline and palms,
with the make.fun ghost eclipsing the sun.

```sh
node main.ts
# writes ./output/entry.png and ./meme.png
```

The ghost is the official make.fun mark from the press kit
(https://make.fun/press/), bundled under `assets/` and used as-is.

## The post

The X post text is in [CAPTION.txt](CAPTION.txt) and its address in
[POST.json](POST.json). The post goes out from a public X account, carries
the bounty link and `@makefunai`, and one of @mereum's play codes.

Competition: https://make.fun/bounty/gta6-meme-x-01

## License

MIT — see [LICENSE](LICENSE).
