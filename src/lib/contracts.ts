export type Evidence = { line: number; text: string };
export type Candidate<T> = { value: T; evidence: Evidence };
export type ReceiptValues = {
  merchant: string | null;
  transactionDate: string | null;
  totalYen: number | null;
  taxes: { rate: number | null; taxableYen: number | null; taxYen: number | null }[];
  paymentMethod: string | null;
  registrationNumber: string | null;
  items: string[];
  summary: string | null;
  category: string | null;
};
export type ClassificationInput = Pick<ReceiptValues, "merchant" | "totalYen" | "items"> & { text: string; availableCategories: string[] };
export type Classification = { category: string | null; reasons: string[]; rules: string[]; method: "rules"; version: string };
export interface Classifier { classify(input: ClassificationInput): Classification }
export type Extraction = {
  version: string; values: ReceiptValues; reasons: string[];
  candidates: { dates: Candidate<string>[]; totals: Candidate<number>[]; merchant: Candidate<string>[] };
  classification: Classification;
};
export type ReceiptView = {
  version: number; userEdited: boolean;
  id: string; captureId: string; capturedAt: string; createdAt: string; acceptedAt: string | null;
  intakeState: string; archiveState: string; ocrState: string; reviewState: string;
  merchant: string | null; transactionDate: string | null; totalYen: number | null;
  values: ReceiptValues | null; reviewReasons: string[]; archiveError: string | null; ocrError: string | null;
  driveUrl: string | null;
};
