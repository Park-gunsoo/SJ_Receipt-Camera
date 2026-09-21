import { DetailScreen } from "@/components/detail-screen";
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) { return <DetailScreen id={(await params).id} />; }
