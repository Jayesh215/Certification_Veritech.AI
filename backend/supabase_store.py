"""Postgres document store backed by the Supabase database."""
import json
import os
import re
import ssl
import uuid
from typing import Any, Optional

import asyncpg


def _ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    # The pooler certificate chain is not trusted by this machine's store.
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _matches(doc: dict, filt: Optional[dict]) -> bool:
    if not filt:
        return True
    for key, expected in filt.items():
        if key == "$or":
            if not any(_matches(doc, part) for part in expected):
                return False
            continue
        if key == "$and":
            if not all(_matches(doc, part) for part in expected):
                return False
            continue
        if isinstance(expected, dict):
            actual = doc.get(key)
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$regex" in expected:
                flags = re.IGNORECASE if "i" in expected.get("$options", "") else 0
                try:
                    matched = re.search(expected["$regex"], str(actual or ""), flags)
                except re.error:
                    matched = None
                if not matched:
                    return False
            continue
        if doc.get(key) != expected:
            return False
    return True


def _sort_key(doc: dict, field: str):
    value = doc.get(field)
    if isinstance(value, (int, float)):
        return (0, value)
    return (1, "" if value is None else str(value))


def _json_text(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return str(value)


def _simple_eq_pairs(filt: Optional[dict]) -> Optional[list[tuple[str, Any]]]:
    """Return equality pairs when the filter is a flat key=value map (no operators)."""
    if filt is None:
        return []
    pairs: list[tuple[str, Any]] = []
    for key, expected in filt.items():
        if key.startswith("$") or isinstance(expected, dict):
            return None
        if not isinstance(expected, (str, int, float, bool)) and expected is not None:
            return None
        pairs.append((key, expected))
    return pairs


def _parse_doc(raw: Any) -> dict:
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


class _Query:
    def __init__(self, collection: "Collection", filt: Optional[dict]):
        self.collection = collection
        self.filt = filt or {}
        self._field = None
        self._direction = 1

    def sort(self, field: str, direction: int = 1):
        self._field = field
        self._direction = direction
        return self

    async def to_list(self, limit: int):
        pairs = _simple_eq_pairs(self.filt)
        if pairs is not None:
            # Push LIMIT + ORDER BY into SQL so we don't over-fetch or sort after truncating.
            docs = await self.collection._fetch_eq(
                pairs,
                limit=limit,
                order_field=self._field,
                order_desc=self._direction < 0,
            )
            return docs
        docs = [doc for doc in await self.collection._all() if _matches(doc, self.filt)]
        if self._field:
            docs.sort(key=lambda doc: _sort_key(doc, self._field), reverse=self._direction < 0)
        return docs[:limit]


class Collection:
    def __init__(self, store: "DocumentStore", name: str):
        self.store = store
        self.name = name

    async def _all(self) -> list[dict]:
        rows = await self.store.pool.fetch(
            "SELECT id, doc FROM app_documents WHERE collection = $1",
            self.name,
        )
        return [_parse_doc(row["doc"]) for row in rows]

    async def _fetch_eq(
        self,
        pairs: list[tuple[str, Any]],
        limit: Optional[int] = None,
        order_field: Optional[str] = None,
        order_desc: bool = False,
    ) -> list[dict]:
        where = ["collection = $1"]
        args: list[Any] = [self.name]

        if len(pairs) == 1 and pairs[0][0] == "_id":
            where.append("id = $2")
            args.append(str(pairs[0][1]))
        else:
            for key, value in pairs:
                args.append(key)
                args.append(_json_text(value))
                where.append(f"doc->>${len(args) - 1} = ${len(args)}")

        sql = f"SELECT doc FROM app_documents WHERE {' AND '.join(where)}"
        if order_field and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", order_field):
            direction = "DESC" if order_desc else "ASC"
            # created_at / updated_at are ISO strings — lexicographic order matches chronology
            args.append(order_field)
            sql += f" ORDER BY doc->>${len(args)} {direction} NULLS LAST"
        if limit is not None:
            args.append(int(limit))
            sql += f" LIMIT ${len(args)}"
        rows = await self.store.pool.fetch(sql, *args)
        return [_parse_doc(row["doc"]) for row in rows]

    async def find_one(self, filt: Optional[dict] = None) -> Optional[dict]:
        pairs = _simple_eq_pairs(filt)
        if pairs is not None:
            docs = await self._fetch_eq(pairs, limit=1)
            return docs[0] if docs else None
        for doc in await self._all():
            if _matches(doc, filt):
                return doc
        return None

    def find(self, filt: Optional[dict] = None, projection: Optional[dict] = None):
        return _Query(self, filt)

    async def insert_one(self, doc: dict) -> None:
        stored = dict(doc)
        doc_id = str(stored.get("_id") or stored.get("registration_id") or uuid.uuid4())
        stored.setdefault("_id", doc_id)
        await self.store.pool.execute(
            """
            INSERT INTO app_documents (collection, id, doc)
            VALUES ($1, $2, $3::jsonb)
            """,
            self.name,
            doc_id,
            json.dumps(stored),
        )

    async def update_one(self, filt: dict, update: dict, upsert: bool = False) -> None:
        changes = update.get("$set", {})
        payload = json.dumps(changes)
        pairs = _simple_eq_pairs(filt)

        # Fast path: update a single matching row without locking the whole collection.
        # Concurrent payments / registrations for different users can proceed in parallel.
        if pairs is not None and pairs:
            if len(pairs) == 1 and pairs[0][0] == "_id":
                result = await self.store.pool.execute(
                    """
                    UPDATE app_documents
                    SET doc = doc || $3::jsonb
                    WHERE collection = $1 AND id = $2
                    """,
                    self.name,
                    str(pairs[0][1]),
                    payload,
                )
            else:
                where = ["collection = $1"]
                args: list[Any] = [self.name]
                for key, value in pairs:
                    args.append(key)
                    args.append(_json_text(value))
                    where.append(f"doc->>${len(args) - 1} = ${len(args)}")
                args.append(payload)
                result = await self.store.pool.execute(
                    f"""
                    UPDATE app_documents
                    SET doc = doc || ${len(args)}::jsonb
                    WHERE {' AND '.join(where)}
                    """,
                    *args,
                )
            updated = 0
            try:
                updated = int(str(result).split()[-1])
            except (TypeError, ValueError, IndexError):
                updated = 0
            if updated > 0:
                return
            if not upsert:
                return
            created = {}
            for key, value in pairs:
                created[key] = value
            created.update(changes)
            doc_id = str(created.get("_id") or created.get("registration_id") or uuid.uuid4())
            created.setdefault("_id", doc_id)
            await self.store.pool.execute(
                """
                INSERT INTO app_documents (collection, id, doc)
                VALUES ($1, $2, $3::jsonb)
                ON CONFLICT (collection, id) DO UPDATE
                SET doc = app_documents.doc || EXCLUDED.doc
                """,
                self.name,
                doc_id,
                json.dumps(created),
            )
            return

        # Complex filters: scan without locking every row (keeps multi-user writes concurrent).
        rows = await self.store.pool.fetch(
            "SELECT id, doc FROM app_documents WHERE collection = $1",
            self.name,
        )
        match_id = None
        for row in rows:
            if _matches(_parse_doc(row["doc"]), filt):
                match_id = row["id"]
                break
        if match_id:
            await self.store.pool.execute(
                """
                UPDATE app_documents
                SET doc = doc || $3::jsonb
                WHERE collection = $1 AND id = $2
                """,
                self.name,
                match_id,
                payload,
            )
            return
        if not upsert:
            return
        created = {}
        for key, value in filt.items():
            if key.startswith("$") or isinstance(value, dict):
                continue
            created[key] = value
        created.update(changes)
        doc_id = str(created.get("_id") or created.get("registration_id") or uuid.uuid4())
        created.setdefault("_id", doc_id)
        await self.store.pool.execute(
            """
            INSERT INTO app_documents (collection, id, doc)
            VALUES ($1, $2, $3::jsonb)
            """,
            self.name,
            doc_id,
            json.dumps(created),
        )

    async def find_one_and_update(
        self,
        filt: dict,
        update: dict,
        upsert: bool = False,
        return_document: bool = False,
    ) -> Optional[dict]:
        if "$inc" in update and list(filt) == ["_id"]:
            doc_id = str(filt["_id"])
            field, amount = next(iter(update["$inc"].items()))
            row = await self.store.pool.fetchrow(
                """
                INSERT INTO app_documents (collection, id, doc)
                VALUES ($1, $2, $3::jsonb)
                ON CONFLICT (collection, id)
                DO UPDATE SET doc = jsonb_set(
                    app_documents.doc,
                    $4::text[],
                    to_jsonb(COALESCE((app_documents.doc->>$5)::int, 0) + $6)
                )
                RETURNING doc
                """,
                self.name,
                doc_id,
                json.dumps({"_id": doc_id, field: amount}),
                [field],
                field,
                amount,
            )
            doc = row["doc"]
            return doc if isinstance(doc, dict) else json.loads(doc)
        await self.update_one(filt, update, upsert=upsert)
        return await self.find_one(filt)

    async def count_documents(self, filt: Optional[dict] = None) -> int:
        pairs = _simple_eq_pairs(filt)
        if pairs is not None and not pairs:
            row = await self.store.pool.fetchrow(
                "SELECT COUNT(*)::int AS c FROM app_documents WHERE collection = $1",
                self.name,
            )
            return int(row["c"]) if row else 0
        if pairs is not None:
            docs = await self._fetch_eq(pairs)
            return len(docs)
        docs = await self._all()
        return sum(1 for doc in docs if _matches(doc, filt))

    async def delete_all(self) -> int:
        """Remove every document in this collection. Returns deleted row count."""
        result = await self.store.pool.execute(
            "DELETE FROM app_documents WHERE collection = $1",
            self.name,
        )
        try:
            return int(str(result).split()[-1])
        except (TypeError, ValueError, IndexError):
            return 0

    async def delete_many_by_ids(self, ids: list[str]) -> int:
        """Delete documents whose primary key `id` is in the given list."""
        clean_ids = [str(i) for i in ids if i]
        if not clean_ids:
            return 0
        result = await self.store.pool.execute(
            "DELETE FROM app_documents WHERE collection = $1 AND id = ANY($2::text[])",
            self.name,
            clean_ids,
        )
        try:
            return int(str(result).split()[-1])
        except (TypeError, ValueError, IndexError):
            return 0

    async def delete_many_by_field(self, field: str, values: list[str]) -> int:
        """Delete documents where doc->>field is in values (also matches row id)."""
        clean = [str(v) for v in values if v]
        if not clean:
            return 0
        # field is a trusted column path from our own API (not user-controlled SQL).
        result = await self.store.pool.execute(
            f"""
            DELETE FROM app_documents
            WHERE collection = $1
              AND (id = ANY($2::text[]) OR doc->>$3 = ANY($2::text[]))
            """,
            self.name,
            clean,
            field,
        )
        try:
            return int(str(result).split()[-1])
        except (TypeError, ValueError, IndexError):
            return 0

    def aggregate(self, pipeline: list[dict]):
        return _Aggregate(self, pipeline)

    async def create_index(self, *args, **kwargs) -> None:
        return None


class _Aggregate:
    def __init__(self, collection: Collection, pipeline: list[dict]):
        self.collection = collection
        self.pipeline = pipeline

    async def to_list(self, limit: int):
        docs = await self.collection._all()
        field = None
        default = None
        for stage in self.pipeline:
            if "$match" in stage:
                docs = [doc for doc in docs if _matches(doc, stage["$match"])]
            if "$group" in stage:
                group_id = stage["$group"]["_id"]
                if isinstance(group_id, dict) and "$ifNull" in group_id:
                    field = group_id["$ifNull"][0].lstrip("$")
                    default = group_id["$ifNull"][1]
        counts: dict[Any, int] = {}
        for doc in docs:
            label = doc.get(field) if field else None
            if label in (None, ""):
                label = default
            counts[label] = counts.get(label, 0) + 1
        rows = [{"_id": label, "count": count} for label, count in counts.items()]
        rows.sort(key=lambda row: row["count"], reverse=True)
        return rows[:limit]


class DocumentStore:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    def __getattr__(self, name: str) -> Collection:
        if name.startswith("_") or self.pool is None:
            raise AttributeError(name)
        return Collection(self, name)

    async def connect(self) -> None:
        # Larger pool so many concurrent payments / page loads are not queued.
        self.pool = await asyncpg.create_pool(
            host=os.environ.get("SUPABASE_DB_HOST", "aws-0-ap-northeast-1.pooler.supabase.com"),
            port=int(os.environ.get("SUPABASE_DB_PORT", "5432")),
            user=os.environ.get("SUPABASE_DB_USER", "postgres.wppwlizvrvjtqhurdgtz"),
            password=os.environ["SUPABASE_DB_PASSWORD"],
            database=os.environ.get("SUPABASE_DB_NAME", "postgres"),
            ssl=_ssl_context(),
            min_size=2,
            max_size=20,
            statement_cache_size=0,
            command_timeout=30,
        )
        await self.pool.execute(
            """
            CREATE TABLE IF NOT EXISTS app_documents (
                collection text NOT NULL,
                id text NOT NULL,
                doc jsonb NOT NULL,
                PRIMARY KEY (collection, id)
            )
            """
        )
        # Expression indexes for hot lookup paths used during registration + payment.
        await self.pool.execute(
            """
            CREATE INDEX IF NOT EXISTS app_documents_collection_idx
            ON app_documents (collection)
            """
        )
        await self.pool.execute(
            """
            CREATE INDEX IF NOT EXISTS app_documents_reg_id_idx
            ON app_documents (collection, (doc->>'registration_id'))
            """
        )
        await self.pool.execute(
            """
            CREATE INDEX IF NOT EXISTS app_documents_email_idx
            ON app_documents (collection, (doc->>'email'))
            """
        )
        await self.pool.execute(
            """
            CREATE INDEX IF NOT EXISTS app_documents_cert_idx
            ON app_documents (collection, (doc->>'certificate_number'))
            """
        )
        await self.pool.execute(
            """
            CREATE INDEX IF NOT EXISTS app_documents_payment_status_idx
            ON app_documents (collection, (doc->>'payment_status'))
            """
        )

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None
