import { WebReceiptEditor } from "@/components/web-receipt-editor";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WebReceiptEditor key={id} id={id} />;
}
