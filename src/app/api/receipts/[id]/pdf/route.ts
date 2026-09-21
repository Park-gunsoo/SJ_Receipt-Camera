import { requireUser } from "@/lib/auth";
import { ownedReceipt } from "@/lib/receipts";
import { apiError, AppError } from "@/lib/http";
import { pdfKey, signedReadUrl } from "@/lib/storage";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const receipt = await ownedReceipt(user.id, (await params).id);
    if (receipt.pdfState === "SAVED") return new Response(null, { status: 307, headers: { Location: await signedReadUrl(pdfKey(receipt.objectKey)), "Cache-Control": "private, no-store" } });
    // Legacy PDFs stay accessible while their independent app copies are being prepared.
    if (!receipt.driveFileId || receipt.archiveState !== "SAVED") throw new AppError("PDF_PENDING", 409);
    return new Response(null, { status: 307, headers: { Location: `https://drive.google.com/file/d/${receipt.driveFileId}/view`, "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
