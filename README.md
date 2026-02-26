<div align="center">

<img src="https://raw.githubusercontent.com/soumyaprasadrana/lean-normalizer/main/assets/lean-banner.svg" alt="LEAN Normalizer" width="800" />

# `lean-normalizer`

### **L**ossless **E**nterprise **A**PI **N**ormalization

**Shrinks enterprise JSON payloads by 40–60% before they reach your LLM — without losing a single field.**

[![CI](https://github.com/soumyaprasadrana/lean-normalizer/actions/workflows/ci.yml/badge.svg)](https://github.com/soumyaprasadrana/lean-normalizer/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@soumyaprasadrana/lean-normalizer.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@soumyaprasadrana/lean-normalizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/soumyaprasadrana/lean-normalizer/pulls)

> Experimental. Tested against IBM Maximo REST/OSLC responses with Claude Desktop and OpenAI tool calling.

</div>

---

## The Problem

Enterprise APIs don't return just data — they return infrastructure. A single page of 15 records from a Maximo system contains `_rowstamp` tokens on every record, `slarecords_collectionref` / `labtrans_collectionref` / `ticketprop_collectionref` pagination handles that the LLM can never call, repeated strings like `PRIYA.N`, `SR`, `MAXUSER1`, and `PLANTOPS` duplicated across every row, and HTML markup embedded in long description fields. The LLM never asked for any of it.

Here is a realistic mock example — a single service record from a Maximo `cduiincident` query:

```json
{
  "owner": "PRIYA.N",
  "status_description": "In Progress",
  "slarecords_collectionref": "api/os/cduiincident/_VElDS0VULzEwMDE3Mw--/slarecords",
  "description_longdescription": "Cooling Tower CT-04 has been in vibration alarm state since 2026-01-23. Site operator reported repeated trips during shift handover and requested urgent reliability review.",
  "labtrans_collectionref": "api/os/cduiincident/_VElDS0VULzEwMDE3Mw--/labtrans",
  "ticketuid": 431,
  "changeby": "PRIYA.N",
  "reportdate": "2025-12-06T21:09:13-08:00",
  "class_description": "Service Request",
  "description": "High Priority: Cooling Tower Vibration Alarm Not Acknowledged",
  "changedate": "2026-01-29T17:20:33-08:00",
  "ownergroup": "PLANTOPS",
  "statusdate": "2026-01-29T17:20:31-08:00",
  "_rowstamp": "26338737",
  "accumulatedholdtime": 0,
  "createdby": "MAXUSER1",
  "ticketprop_collectionref": "api/os/cduiincident/_VElDS0VULzEwMDE3Mw--/ticketprop",
  "relatedrecord_collectionref": "api/os/cduiincident/_VElDS0VULzEwMDE3Mw--/relatedrecord",
  "href": "api/os/cduiincident/_VElDS0VULzEwMDE3Mw--",
  "class": "SR",
  "origfromalert": false,
  "doclinks": { "href": "...", "member": [] },
  "ticketid": 100173,
  "status": "INPROG"
}
```

That is one record. A page of 15 records — the same payload used to test this library — is **21.6 KB**. Sent raw to the LLM: ~5,400 tokens, most of which are `collectionref` handles, repeated class names, rowstamps, and ownergroup values.

After LEAN encoding, the same 15 records become **10.5 KB** — a 51% reduction. The encoding looks like this:

```
### LEAN FORMAT v1

### DICT
*0=PRIYA.N
*1=SR
*2=Service Request
*3=MAXUSER1
*4=QUEUED
*5=Queued
*9=INPROG
*10=In Progress
...

### SCHEMA
0=accumulatedholdtime
1=changeby
2=changedate
3=class
4=class_description
5=createdby
7=href
8=origfromalert
9=owner
a=ownergroup
b=reportdate
c=status
d=status_description
e=statusdate
f=ticketid
g=ticketuid
h=description
i=description_longdescription
...

### DATA: member
_id:0 0:0 1:"*0" 2:"2026-01-29T08:45:34-08:00" 3:"*1" 4:"*2" 5:"*3" 7:api/os/cduiincident/_VElDS0VULzEwMDE3MQ-- 8:false 9:"*0" a:PLANTOPS b:"2025-12-06T11:29:03-08:00" c:"*4" d:"*5" e:"2026-01-29T08:40:58-08:00" f:100171 g:428
_id:1 0:0 1:"*0" 2:"2026-01-29T17:20:33-08:00" 3:"*1" 4:"*2" 5:"*3" h:"High Priority: Cooling Tower Vibration Alarm Not Acknowledged" i:"Cooling Tower CT-04 has been in vibration alarm state since 2026-01-23..." 7:api/os/cduiincident/_VElDS0VULzEwMDE3Mw-- 8:false 9:"*0" a:PLANTOPS b:"2025-12-06T21:09:13-08:00" c:"*9" d:"*10" e:"2026-01-29T17:20:31-08:00" f:100173 g:431
...
```

What happened:

- `_rowstamp`, `slarecords_collectionref`, `labtrans_collectionref`, `ticketprop_collectionref`, `relatedrecord_collectionref` — suppressed. The LLM can't use them.
- `PRIYA.N`, `SR`, `Service Request`, `MAXUSER1`, `QUEUED` — appeared 15 times each. Now stored once in `### DICT`, referenced as `*0`, `*1`, `*2`, `*3`, `*4`.
- All field names — `status_description`, `class_description`, `accumulatedholdtime` etc. — replaced with single base-36 characters from `### SCHEMA`.
- `href` on each record — kept, emitted raw. The LLM needs it for `PATCH`/`GET` follow-up calls.
- ISO dates — kept raw, never pointer-encoded. The LLM can parse them directly.
- HTML in `description_longdescription` — stripped before encoding.
- Nested `relatedrecord` arrays — decomposed into a `member.relatedrecord` child table with `_p` parent references.

The LLM receives a compact, structured payload. It reads `### SCHEMA` once to map short keys to field names, then reads `### DICT` once to expand `*N` pointers. Everything else is inline data.

---

## What It Is

LEAN is a **pre-processing layer for MCP tool servers** that retrieve data from enterprise APIs. It is not a general compression library. It is not streaming-safe. It is not a binary format.

It is specifically designed for the pattern: *tool calls an enterprise API, tool returns the response to an LLM, LLM acts on the data*. The format is human-readable and reversible — the LLM can reconstruct any original value without any client-side code.

Tested on IBM Maximo REST/OSLC API responses with Claude Desktop and OpenAI tool calling. The adapters ship for Maximo, ServiceNow, and SAP OData. New adapters take about 30 lines of TypeScript.

---

## Features

| | |
|---|---|
| **40–60% token reduction** | On real Maximo / ServiceNow / SAP payloads |
| **Lossless** | Every field value is preserved — nothing dropped silently |
| **Deterministic** | Same input always produces identical output |
| **Tool-safe** | `href` and ISO dates bypass dictionary encoding — agents call them directly |
| **Circuit breaker** | Falls back to raw JSON automatically when encoding is not beneficial |
| **Adapter-driven** | All vendor-specific logic is injected — zero assumptions in core |
| **Zero runtime dependencies** | Pure TypeScript |

---

## How It Works

Given the incident payload above, encoding runs in two passes:

**Pass 1** — `TableBuilder` walks each record, calls `adapter.shouldSkipKey()` and checks `adapter.skipPatterns` to suppress noise keys, calls `adapter.normalizeValue()` to strip HTML and convert dates, and registers qualifying strings with `Dictionary`. Nested object-arrays (like `relatedrecord`) are decomposed into named child tables linked by `_p` parent ID. Field paths are normalised through `adapter.normalizePath()` — Maximo's `spi:wonum` becomes `wonum` in the schema.

Between passes, `Dictionary.buildSlots()` assigns `*N` pointer indices to every string that appears at or above `dictMinFrequency` and meets `dictMinLength`. In the example above, `PRIYA.N` (appears 13 times), `SR` (15 times), `QUEUED` (10 times) all get slots. ISO dates and `href` values are explicitly excluded by `adapter.shouldDictionaryEncode()` returning `false`.

**Pass 2** — `TableBuilder.resolveDictionary()` replaces sentinel-wrapped strings with their `*N` pointer or their escaped inline value.

Finally, the circuit breaker compares `encodedSize` to `originalSize`. If encoding made things larger — which can happen with very small or highly unique payloads — it returns the original JSON unchanged, with `compressed: false` in the result.

The output format is:

```
### LEAN FORMAT v1

### DICT        one line per pointer:  *N=value
### SCHEMA      one line per field:    shortKey=fullPath
### DATA: name  one line per record:   _id:N key:value key:*N ...
```

Child tables follow with `_id`, `_p` (parent `_id`), and their own fields. The LLM resolves everything by reading the two header blocks once.

---

## Installation

```bash
npm install @soumyaprasadrana/lean-normalizer
```

---

## Quick Start

```typescript
import { LeanEncoder, MaximoAdapter } from '@soumyaprasadrana/lean-normalizer';

const encoder = new LeanEncoder({ adapter: new MaximoAdapter() });
const result  = encoder.encode(maximoApiResponse);

console.log(result.encoded);      // LEAN wire format — or raw JSON if circuit breaker fired
console.log(result.compressed);   // false means raw JSON was returned
console.log(result.ratio);        // 0.49 = 51% smaller
console.log(result.originalSize); // bytes
console.log(result.encodedSize);  // bytes
```

---

## Using in an MCP Tool

This is the primary use case. The tool description tells the LLM how to decode the format — this is important because the LLM needs to know the format exists before it tries to read `### SCHEMA`.

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LeanEncoder, MaximoAdapter } from '@soumyaprasadrana/lean-normalizer';
import { z } from 'zod';

const encoder = new LeanEncoder({ adapter: new MaximoAdapter() });

server.tool(
  'get_incidents',
  {
    description:
      'Returns open Maximo incidents. When the response contains "### LEAN FORMAT v1", ' +
      'it is LEAN-encoded. Use ### SCHEMA to map short keys back to field names, ' +
      'and ### DICT to expand *N pointer values. ' +
      'href values and ISO dates are always emitted raw (never pointer-encoded) ' +
      'so you can pass them directly as arguments to update_incident or get_incident.',
    inputSchema: z.object({
      status:   z.string().optional().describe('Filter by status: QUEUED, INPROG, RESOLVED, CLOSED'),
      ownergroup: z.string().optional().describe('Filter by owner group'),
      pageSize: z.number().optional().default(20),
    }),
  },
  async ({ status, ownergroup, pageSize }) => {
    const raw    = await maximo.getIncidents({ status, ownergroup, pageSize });
    const result = encoder.encode(raw);

    return {
      content: [{
        type: 'text',
        text: result.encoded,
      }],
      _meta: {
        lean_compressed:   result.compressed,
        lean_ratio:        result.ratio,
        lean_original_bytes: result.originalSize,
        lean_encoded_bytes:  result.encodedSize,
      },
    };
  }
);
```

The `_meta` block is optional but useful — it lets you inspect compression stats in tool call traces without parsing the encoded text.

### Making compression opt-in with a flag

If you want the LLM to be able to request raw JSON (for debugging or when working with very small result sets), pass a `useLean` flag:

```typescript
server.tool(
  'get_incidents',
  {
    description:
      'Returns open Maximo incidents. Pass useLean=true (default) for a compact LEAN-encoded ' +
      'response, or useLean=false to receive raw JSON. ' +
      'When LEAN-encoded (### LEAN FORMAT v1 header present), use ### SCHEMA to resolve ' +
      'short keys and ### DICT to expand *N pointer values. ' +
      'href and ISO date values are always raw regardless of mode.',
    inputSchema: z.object({
      status:   z.string().optional(),
      useLean:  z.boolean().optional().default(true),
    }),
  },
  async ({ status, useLean = true }) => {
    const raw = await maximo.getIncidents({ status });

    if (!useLean) {
      return { content: [{ type: 'text', text: JSON.stringify(raw, null, 2) }] };
    }

    const result = encoder.encode(raw);
    return {
      content: [{
        type: 'text',
        text: result.encoded,
      }],
    };
  }
);
```

### Per-call configuration

You can also vary encoder settings per call — for example, lowering `dictMinLength` when working with short-code-heavy data like status fields:

```typescript
const defaultEncoder = new LeanEncoder({ adapter: new MaximoAdapter() });
const aggressiveEncoder = new LeanEncoder({
  adapter:          new MaximoAdapter(),
  dictMinLength:    3,    // catch short codes like NT30, WO, etc.
  dictMinFrequency: 1,    // encode even single-occurrence strings
  stripHTML:        true,
  skipEmptyStrings: true,
});

// Use aggressive encoder when the caller signals a large payload
const result = (pageSize > 50 ? aggressiveEncoder : defaultEncoder).encode(raw);
```

---

## Built-in Adapters

### IBM Maximo (OSLC / REST)

```typescript
import { LeanEncoder, MaximoAdapter } from '@soumyaprasadrana/lean-normalizer';

const encoder = new LeanEncoder({ adapter: new MaximoAdapter() });
const result  = encoder.encode(maximoOslcResponse);
```

The MaximoAdapter detects the root array at `payload.member` (or `rdfs:member`, or working-set shapes), derives the table name from the OSLC Object Structure in the collection `href` (so `api/os/cduiincident` becomes table `cduiincident`), keeps `href` on each record, suppresses `_rowstamp` / `localref` / `_collectionref` fields, strips `spi:` / `rdf:` / `oslc:` namespace prefixes from field names, strips HTML from string values, and skips empty string fields.

### ServiceNow (Table API)

```typescript
import { LeanEncoder, ServiceNowAdapter } from '@soumyaprasadrana/lean-normalizer';

const encoder = new LeanEncoder({ adapter: new ServiceNowAdapter() });
const result  = encoder.encode(serviceNowTableResponse);
```

Detects root at `payload.result`. Drops the `link` half of reference objects `{ link, value }` — keeps `value`. Suppresses `sys_class_name`, `sys_domain`, `sys_domain_path`.

### SAP OData (v2 and v4)

```typescript
import { LeanEncoder, SAPAdapter } from '@soumyaprasadrana/lean-normalizer';

const encoder = new LeanEncoder({ adapter: new SAPAdapter() });
const result  = encoder.encode(sapOdataResponse);
```

Detects root at `payload.d.results` (OData v2) or `payload.value` (OData v4). Strips `__metadata` and `__deferred`. Converts `/Date(ms)/` timestamps to ISO-8601.

---

## Configuration

```typescript
const encoder = new LeanEncoder({
  adapter:          new MaximoAdapter(), // default: GenericAdapter
  dictMinLength:    6,                   // min string length to qualify for dictionary (default: 6)
  dictMinFrequency: 1,                   // min occurrences before a slot is assigned (default: 1)
  stripHTML:        true,                // strip HTML tags from string values (default: true)
  skipEmptyStrings: true,                // omit fields with empty-string values (default: true)
  fallbackOnFail:   true,                // return raw JSON on any encoding error (default: true)
});
```

```typescript
interface LeanEncodeResult {
  encoded:      string;  // LEAN wire format, or raw JSON if circuit breaker fired
  compressed:   boolean; // false = raw JSON was returned
  originalSize: number;  // input byte length
  encodedSize:  number;  // output byte length
  ratio:        number;  // encodedSize / originalSize  (0.49 = 51% smaller)
}
```

---

## Custom Adapters

```typescript
import { LeanAdapter } from '@soumyaprasadrana/lean-normalizer';

export class MyAdapter implements LeanAdapter {
  name = 'my-api';

  // Regex patterns applied to every key before shouldSkipKey
  skipPatterns = [/_links$/, /^_embedded$/];

  findRoot(payload: unknown) {
    return { name: 'items', data: (payload as any).data.items };
  }

  shouldSkipKey(keyPath: string, value: unknown): boolean {
    return keyPath.endsWith('._links');
  }

  shouldDictionaryEncode(value: string): boolean {
    if (value.startsWith('http')) return false; // keep URLs raw
    return value.length >= 6;
  }

  // Strip namespace prefixes from key paths before they reach the schema registry
  normalizePath(keyPath: string): string {
    return keyPath.split('.').map(s => s.replace(/^[a-z]+:/, '')).join('.');
  }

  normalizeValue(value: unknown): unknown {
    if (typeof value === 'string') return value.trim();
    return value;
  }
}
```

---

## Development

```bash
git clone https://github.com/soumyaprasadrana/lean-normalizer.git
cd lean-normalizer
npm install
npm run build
npm test
```

---

## Publishing to npm

### Automated via GitHub Release

1. Add `NPM_TOKEN` to **GitHub → Settings → Secrets → Actions**
2. Go to **GitHub → Releases → Draft a new release**
3. Set tag to match `package.json` version, e.g. `v1.0.0`
4. Click **Publish release** — the `publish.yml` workflow fires automatically

### Manual

```bash
npm version patch
git push --follow-tags
npm publish --access public
```

---

## Contributing

New adapters for other enterprise APIs are welcome. The pattern is simple — implement `LeanAdapter`, add a fixture JSON in `tests/input/`, and add a test file. Open a pull request.

---

## License

[MIT](LICENSE) © [Soumya Prasad Rana](https://github.com/soumyaprasadrana)

---

<div align="center">

**[npm](https://www.npmjs.com/package/@soumyaprasadrana/lean-normalizer) · [Issues](https://github.com/soumyaprasadrana/lean-normalizer/issues) · [Pull Requests](https://github.com/soumyaprasadrana/lean-normalizer/pulls)**

</div>

