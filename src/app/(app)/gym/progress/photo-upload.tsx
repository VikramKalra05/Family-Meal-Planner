"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const input =
  "w-full rounded-none border-2 border-neutral-900 bg-white px-2 py-1.5 text-sm focus:shadow-[2px_2px_0_#111] focus:outline-none";

export function PhotoUpload({ memberId, today }: { memberId: string; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Pick a photo first.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Keep it under 8 MB.");
      return;
    }
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const takenOn = String(form.get("takenOn") || today);
    const pose = String(form.get("pose") || "front");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const path = `${memberId}/${id}.${ext}`;
    const supabase = createClient();

    const { error: uploadError } = await supabase.storage
      .from("progress-photos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setBusy(false);
      setError(uploadError.message);
      return;
    }

    const { error: insertError } = await supabase.from("progress_photos").insert({
      member_id: memberId,
      taken_on: takenOn,
      storage_path: path,
      pose,
    });
    if (insertError) {
      await supabase.storage.from("progress-photos").remove([path]);
      setBusy(false);
      setError(insertError.message);
      return;
    }

    setFile(null);
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={upload} className="mt-3 space-y-2">
      <input
        type="file"
        accept="image/*"
        aria-label="Progress photo"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full text-xs file:mr-2 file:border-2 file:border-neutral-900 file:bg-yellow-300 file:px-3 file:py-1.5 file:text-[10px] file:font-extrabold file:uppercase"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Date
          <input type="date" name="takenOn" defaultValue={today} className={input} />
        </label>
        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Pose
          <select name="pose" className={input} defaultValue="front">
            <option value="front">Front</option>
            <option value="side">Side</option>
            <option value="back">Back</option>
          </select>
        </label>
      </div>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-none border-2 border-neutral-900 bg-violet-300 px-4 py-2 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload photo"}
      </button>
      <p className="text-[10px] text-neutral-400">
        Private bucket. Only you can read these files; links expire after an hour.
      </p>
    </form>
  );
}
