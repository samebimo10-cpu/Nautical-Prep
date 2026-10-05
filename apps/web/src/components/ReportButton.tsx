import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { db } from "../lib/db";
import { enqueue } from "../lib/sync";

export function ReportButton({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  async function submit() {
    const created_at = new Date().toISOString();
    await db.reports.add({ item_id: itemId, message: msg, created_at, status: "open" });
    await enqueue("report", { item_id: itemId, message: msg, status: "open", created_at });
    setSent(true);
    setMsg("");
    setTimeout(() => {
      setOpen(false);
      setSent(false);
    }, 900);
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="text-xs font-medium text-slate-500 underline hover:text-slate-800">Report a problem</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl">
          <Dialog.Title className="h2">Report this item</Dialog.Title>
          <Dialog.Description className="muted mb-3">Wrong answer, outdated regulation, typo? Reviewers see every report. ({itemId})</Dialog.Description>
          {sent ? (
            <p className="font-semibold text-emerald-700">Thanks — report saved{navigator.onLine ? "" : " and will send when online"}.</p>
          ) : (
            <>
              <label htmlFor="report-msg" className="label">
                What's wrong?
              </label>
              <textarea id="report-msg" className="input min-h-[100px]" value={msg} onChange={(e) => setMsg(e.target.value)} />
              <div className="mt-3 flex justify-end gap-2">
                <Dialog.Close className="btn-ghost">Cancel</Dialog.Close>
                <button className="btn-primary" disabled={msg.trim().length < 3} onClick={submit}>
                  Send report
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
