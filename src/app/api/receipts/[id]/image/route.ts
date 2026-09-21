import sharp from "sharp";
import { requireUser } from "@/lib/auth";
import { ownedReceipt } from "@/lib/receipts";
import { readImage, signedReadUrl } from "@/lib/storage";
import { apiError } from "@/lib/http";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const receipt = await ownedReceipt(user.id, (await params).id);
    if (new URL(request.url).searchParams.get("thumbnail") !== "1") return new Response(null, { status: 307, headers: { Location: await signedReadUrl(receipt.objectKey), "Cache-Control": "private, no-store" } });
    let bytes = await readImage(receipt.objectKey);
    let type = receipt.mimeType;
    if (new URL(request.url).searchParams.get("thumbnail") === "1") { bytes = await sharp(bytes).rotate().resize({ width: 180, height: 240, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer(); type = "image/webp"; }
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
