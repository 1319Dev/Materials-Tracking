"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DocumentRow } from "@/lib/database.types";

const DOC_LABELS: Record<DocumentRow["doc_type"], string> = {
  packing_list: "Packing list",
  mtr: "MTR",
  other: "Other",
};

export function DocumentLinks({ documents }: { documents: DocumentRow[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const next: Record<string, string> = {};
      for (const doc of documents) {
        const { data, error } = await supabase.storage
          .from("material-documents")
          .createSignedUrl(doc.storage_path, 60 * 30);
        if (!error && data?.signedUrl) {
          next[doc.id] = data.signedUrl;
        }
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [documents]);

  return (
    <ul className="divide-y divide-[var(--border)]">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">
              {DOC_LABELS[doc.doc_type]}
            </p>
            <p className="text-xs text-[var(--muted)]">{doc.file_name}</p>
          </div>
          {urls[doc.id] ? (
            <a
              href={urls[doc.id]}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium hover:bg-[var(--surface-2)]"
            >
              Open
            </a>
          ) : (
            <span className="text-xs text-[var(--muted)]">Preparing…</span>
          )}
        </li>
      ))}
    </ul>
  );
}
