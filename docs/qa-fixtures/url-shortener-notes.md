# QA fixture — URL shortener

Canned content for manually testing the design notebook and the AI quiz. Having a fixed topic
makes generation repeatable: run it twice and you can tell whether a prompt change actually
improved the questions, rather than guessing across two different sets of notes.

Deliberately imperfect. It has real numbers and stated trade-offs (good material to quiz on),
and it leaves some things out — the questions should not test what is not here.

---

## Topic

**Title**

```
URL shortener
```

**Prompt**

```
Design a URL shortener like bit.ly. 100M new links/day, 10:1 read-to-write, links never expire.
```

**Tags**

```
Caching, Sharding, Consistent Hashing
```

---

## Notes

Paste into the topic's note editor. Markdown shortcuts apply as you type — `##` becomes a
heading, `-` a bullet, ``` a code block — so pasting plain text is fine, but retyping the
first character of a line is what triggers the formatting.

```
## Scale

100M writes/day is ~1,200 writes/sec, 12,000 reads/sec at 10:1.
Five years of links at 500 bytes each is ~180B rows, roughly 90 TB. Too big for one box,
so sharding is assumed from the start rather than bolted on.

## API

POST /shorten {longUrl, customAlias?} -> {shortUrl}
GET /{key} -> 302 to the long URL

302, not 301. A 301 is cached by the browser forever, which is faster but destroys click
analytics and makes a link impossible to repoint. 302 costs a round trip per click and keeps
both. If analytics were dropped as a requirement, 301 would be the better answer.

## Key generation

Three options considered:

- Hash the URL (MD5/SHA) and take the first 7 chars. Simple, but collisions need a retry loop
  and the same URL always maps to one key — which breaks per-user analytics.
- Random 7-char base62. 62^7 is ~3.5 trillion, plenty, but needs a uniqueness check on write.
- Counter plus base62 encode. No collisions by construction, and no read before write.

Went with the counter. A single counter is a bottleneck, so hand out ranges: each app server
takes a block of 1M ids from ZooKeeper and encodes locally. A server dying wastes at most 1M
ids out of 3.5 trillion, which does not matter.

Downside: keys are sequential and therefore enumerable. Someone can walk the keyspace and
scrape every link. Mitigation would be to XOR the counter with a secret before encoding, which
keeps uniqueness and destroys the ordering.

## Storage

Key-value, not relational. The access pattern is a single-key lookup with no joins and no
transactions, so a KV store shards cleanly and a SQL box does not buy anything.

Shard by hash of the key so load spreads evenly. Sharding by creation date would put every
write on one shard — the newest — which is the classic hot-shard mistake.

## Caching

Reads dominate 10:1, and access is heavily skewed: a small fraction of links take most of the
traffic. Cache the hot set in Redis, LRU eviction, cache-aside.

Rough guess at 20% of daily reads cached: ~1B reads/day, 20% is 200M entries, at ~500 bytes
that is ~100 GB, so a small Redis cluster rather than one node.

Links are immutable once created, so there is no invalidation problem at all — the usual
hardest part of caching simply does not arise here.

## Analytics

Do not write to the database on the read path; 12,000 writes/sec of click events would swamp
it. Fire the click onto Kafka and aggregate offline. Losing a few click events is acceptable;
adding latency to every redirect is not.

## Open questions

- Custom aliases need a uniqueness check, which reintroduces the read-before-write the counter
  was chosen to avoid. Probably a separate table with a unique constraint.
- Rate limiting on POST is not thought through.
```
