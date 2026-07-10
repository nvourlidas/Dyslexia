// supabase/functions/tests/helpers/mock_supabase.ts
//
// In-memory stand-in for the parts of the Supabase stack the edge functions
// talk to: GoTrue (`/auth/v1/user`) and PostgREST (`/rest/v1/<table>`).
// Used because the machine running the suite has no Docker, so
// `supabase start` is not available. The functions themselves run unmodified
// as real HTTP servers (see harness.ts) — only the backend is emulated.
//
// Supported PostgREST surface (everything the functions use):
//   - GET    select=..., eq., in.() filters, maybeSingle (client-side in supabase-js v2 GET)
//   - POST   insert (object or array), Prefer: return=representation
//   - PATCH  update with filters, .select() → representation
//   - DELETE with filters
//   - FK emulation: 409 / code 23503 on violating insert/update/delete
//   - failNext(): inject a one-shot error for a table+op to exercise DB-error branches

type Row = Record<string, unknown>;

export interface MockUser {
  token: string;
  id: string;
  email?: string;
}

interface Fk {
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
}

interface InjectedError {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  status: number;
  body: { code: string; message: string; details?: string | null; hint?: string | null };
}

const FKS: Fk[] = [
  { childTable: "class_sessions", childColumn: "teacher_id", parentTable: "teacher", parentColumn: "id" },
  { childTable: "class_sessions", childColumn: "class_id", parentTable: "classes", parentColumn: "id" },
  { childTable: "class_session_students", childColumn: "session_id", parentTable: "class_sessions", parentColumn: "id" },
  { childTable: "class_session_students", childColumn: "student_id", parentTable: "students", parentColumn: "user_id" },
  { childTable: "doc_opinion", childColumn: "student_id", parentTable: "students", parentColumn: "user_id" },
  { childTable: "parapemtiko", childColumn: "student_id", parentTable: "students", parentColumn: "user_id" },
  { childTable: "parapemtiko", childColumn: "doc_opinion_id", parentTable: "doc_opinion", parentColumn: "id" },
];

export class MockDb {
  tables = new Map<string, Row[]>();
  users = new Map<string, MockUser>();
  private injected: InjectedError[] = [];

  table(name: string): Row[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }

  addUser(user: MockUser) {
    this.users.set(user.token, user);
  }

  insertRow(table: string, row: Row) {
    this.table(table).push({ ...row });
  }

  /** Inject a one-shot PostgREST error for the next matching operation. */
  failNext(
    table: string,
    op: InjectedError["op"],
    body: Partial<InjectedError["body"]> = {},
    status = 500,
  ) {
    this.injected.push({
      table,
      op,
      status,
      body: {
        code: body.code ?? "XX000",
        message: body.message ?? "injected error",
        details: body.details ?? null,
        hint: body.hint ?? null,
      },
    });
  }

  takeInjected(table: string, op: InjectedError["op"]): InjectedError | null {
    const i = this.injected.findIndex((e) => e.table === table && e.op === op);
    if (i === -1) return null;
    return this.injected.splice(i, 1)[0];
  }

  reset() {
    this.tables.clear();
    this.users.clear();
    this.injected = [];
  }
}

function json(body: unknown, status: number): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function pgError(
  status: number,
  body: { code: string; message: string; details?: string | null; hint?: string | null },
): Response {
  return json({ details: null, hint: null, ...body }, status);
}

function fkViolation(action: "insert or update" | "update or delete", table: string, fk: Fk, value: unknown): Response {
  return pgError(409, {
    code: "23503",
    message: `${action} on table "${action === "update or delete" ? fk.parentTable : table}" violates foreign key constraint "${fk.childTable}_${fk.childColumn}_fkey" on table "${fk.childTable}"`,
    details: action === "update or delete"
      ? `Key (${fk.parentColumn})=(${String(value)}) is still referenced from table "${fk.childTable}".`
      : `Key (${fk.childColumn})=(${String(value)}) is not present in table "${fk.parentTable}".`,
  });
}

type Filter = (row: Row) => boolean;

function parseFilters(params: URLSearchParams): Filter[] {
  const filters: Filter[] = [];
  for (const [key, value] of params.entries()) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
    if (value.startsWith("eq.")) {
      const v = value.slice(3);
      filters.push((row) => String(row[key]) === v);
    } else if (value.startsWith("in.(") && value.endsWith(")")) {
      const inner = value.slice(4, -1);
      const vals = inner === "" ? [] : inner.split(",").map((s) => {
        s = s.trim();
        if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
        return s;
      });
      filters.push((row) => vals.includes(String(row[key])));
    } else if (value.startsWith("is.")) {
      const v = value.slice(3);
      filters.push((row) =>
        v === "null" ? row[key] === null || row[key] === undefined : String(row[key]) === v
      );
    } else if (value.startsWith("neq.")) {
      const v = value.slice(4);
      filters.push((row) => String(row[key]) !== v);
    } else {
      throw new Error(`mock_supabase: unsupported filter ${key}=${value}`);
    }
  }
  return filters;
}

function project(row: Row, select: string | null): Row {
  if (!select || select === "*") return { ...row };
  const out: Row = {};
  for (const col of select.split(",").map((c) => c.trim())) {
    if (col === "*") return { ...row };
    out[col] = row[col] ?? null;
  }
  return out;
}

export interface MockSupabase {
  url: string;
  db: MockDb;
  stop(): Promise<void>;
}

export async function startMockSupabase(): Promise<MockSupabase> {
  const db = new MockDb();

  const handler = (req: Request): Response => {
    const url = new URL(req.url);

    // ---- GoTrue: GET /auth/v1/user ----
    if (url.pathname === "/auth/v1/user") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const user = token ? db.users.get(token) : undefined;
      if (!user) {
        return json({ code: 401, error_code: "bad_jwt", msg: "invalid JWT", message: "invalid JWT" }, 401);
      }
      return json({
        id: user.id,
        aud: "authenticated",
        role: "authenticated",
        email: user.email ?? `${user.id}@test.local`,
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-01-01T00:00:00Z",
      }, 200);
    }

    // ---- PostgREST: /rest/v1/<table> ----
    const m = url.pathname.match(/^\/rest\/v1\/([A-Za-z0-9_]+)$/);
    if (!m) return json({ message: `mock_supabase: no route for ${url.pathname}` }, 404);
    const tableName = m[1];

    const prefer = req.headers.get("prefer") ?? "";
    const accept = req.headers.get("accept") ?? "application/json";
    const wantRepresentation = prefer.includes("return=representation");
    const wantObject = accept.includes("application/vnd.pgrst.object+json");
    const select = url.searchParams.get("select");

    const respondRows = (rows: Row[], status: number): Response => {
      const projected = rows.map((r) => project(r, select));
      if (wantObject) {
        if (projected.length !== 1) {
          return pgError(406, {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: `The result contains ${projected.length} rows`,
          });
        }
        return json(projected[0], status);
      }
      return json(projected, status);
    };

    return (async () => {
      const filters = parseFilters(url.searchParams);
      const rows = db.table(tableName);
      const matches = () => rows.filter((r) => filters.every((f) => f(r)));

      switch (req.method) {
        case "GET": {
          const injected = db.takeInjected(tableName, "select");
          if (injected) return pgError(injected.status, injected.body);
          return respondRows(matches(), 200);
        }

        case "POST": {
          const injected = db.takeInjected(tableName, "insert");
          if (injected) return pgError(injected.status, injected.body);
          const body = await req.json();
          const newRows: Row[] = Array.isArray(body) ? body : [body];
          for (const row of newRows) {
            for (const fk of FKS.filter((f) => f.childTable === tableName)) {
              const v = row[fk.childColumn];
              if (v !== null && v !== undefined) {
                const parentExists = db.table(fk.parentTable).some((p) => String(p[fk.parentColumn]) === String(v));
                if (!parentExists) return fkViolation("insert or update", tableName, fk, v);
              }
            }
          }
          for (const row of newRows) rows.push({ ...row });
          if (wantRepresentation) return respondRows(newRows, 201);
          return new Response(null, { status: 201 });
        }

        case "PATCH": {
          const injected = db.takeInjected(tableName, "update");
          if (injected) return pgError(injected.status, injected.body);
          const patch = await req.json() as Row;
          for (const fk of FKS.filter((f) => f.childTable === tableName)) {
            if (fk.childColumn in patch) {
              const v = patch[fk.childColumn];
              if (v !== null && v !== undefined) {
                const parentExists = db.table(fk.parentTable).some((p) => String(p[fk.parentColumn]) === String(v));
                if (!parentExists) return fkViolation("insert or update", tableName, fk, v);
              }
            }
          }
          const updated = matches();
          for (const row of updated) Object.assign(row, patch);
          if (wantRepresentation) return respondRows(updated, 200);
          return new Response(null, { status: 204 });
        }

        case "DELETE": {
          const injected = db.takeInjected(tableName, "delete");
          if (injected) return pgError(injected.status, injected.body);
          const doomed = new Set(matches());
          for (const fk of FKS.filter((f) => f.parentTable === tableName)) {
            for (const parent of doomed) {
              const pv = parent[fk.parentColumn];
              const referenced = db.table(fk.childTable).some(
                (c) => String(c[fk.childColumn]) === String(pv),
              );
              if (referenced) return fkViolation("update or delete", tableName, fk, pv);
            }
          }
          db.tables.set(tableName, rows.filter((r) => !doomed.has(r)));
          if (wantRepresentation) return respondRows([...doomed], 200);
          return new Response(null, { status: 204 });
        }

        default:
          return json({ message: "method not supported by mock" }, 405);
      }
    })() as unknown as Response;
  };

  let resolveAddr: (addr: Deno.NetAddr) => void;
  const addrPromise = new Promise<Deno.NetAddr>((res) => (resolveAddr = res));
  const server = Deno.serve({
    port: 0,
    hostname: "127.0.0.1",
    onListen: (addr) => resolveAddr(addr as Deno.NetAddr),
  }, async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      return json({ message: `mock_supabase crashed: ${(err as Error).message}` }, 500);
    }
  });

  const addr = await addrPromise;
  return {
    url: `http://127.0.0.1:${addr.port}`,
    db,
    async stop() {
      await server.shutdown();
    },
  };
}
