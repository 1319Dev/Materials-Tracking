import { useEffect, useState } from "react";
import { useGuestData } from "@/auth/auth-context";
import type { DocumentRow } from "@/lib/database.types";
import { guestDocumentHref } from "@/lib/guest-store";
import { supabase } from "@/lib/supabase";

const DOC_LABELS: Record<DocumentRow["doc_type"], string> = {
  packing_list: "Packing list",
  mtr: "MTR",
  other: "Other",
};

export function DocumentLinks({ documents }: { documents: DocumentRow[] }) {
  const local = useGuestData();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      const next: Record<string, string> = {};
      if (local) {
        for (const doc of documents) {
          const href = await guestDocumentHref(doc);
          if (href) next[doc.id] = href;
        }
      } else {
        for (const doc of documents) {
          const { data, error } = await supabase.storage
            .from("material-documents")
            .createSignedUrl(doc.storage_path, 60 * 30);
          if (!error && data?.signedUrl) {
            next[doc.id] = data.signedUrl;
          }
        }
      }
      if (!cancelled) {
        setUrls(next);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documents, local]);

  return (
    <ul className="divide-y divide-[var(--border)]">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">{DOC_LABELS[doc.doc_type]}</p>
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
          ) : ready && local ? (
            <span className="text-xs text-[var(--muted)]">Not stored in the cloud</span>
          ) : (
            <span className="text-xs text-[var(--muted)]">Preparing…</span>
          )}
        </li>
      ))}
    </ul>
  );
}
