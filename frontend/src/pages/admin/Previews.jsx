import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { PageBody } from "../public/PageView";
import { NoteArticle } from "../public/FieldNoteView";

export function PagePreview() {
  const { key } = useParams();
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/admin/pages/${key}/preview`).then((r) => setD(r.data)).catch(() => setD(false)); }, [key]);
  useEffect(() => {
    const m = document.querySelector("meta[name='robots']");
    if (m) m.content = "noindex, nofollow";
  });
  if (d === false) return <p className="wrap section">Preview unavailable.</p>;
  return d ? <PageBody pageKey={key} content={{ ...d.content, seo: { ...d.content.seo, noindex: true } }} /> : null;
}

export function NotePreview() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/admin/notes/${id}/preview`).then((r) => setD(r.data)).catch(() => setD(false)); }, [id]);
  if (d === false) return <p className="wrap section">Preview unavailable.</p>;
  return d ? <NoteArticle note={{ ...d.note, seo: { ...d.note.seo, noindex: true } }} slug={d.note.slug} published_at={d.published_at} updated_at={d.updated_at} related={[]} /> : null;
}
