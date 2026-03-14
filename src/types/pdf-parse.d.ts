declare module "pdf-parse" {
  function pdfParse(
    dataBuffer: Buffer,
    options?: { pwd?: string; max?: number }
  ): Promise<{ numpages: number; numrender: number; info: unknown; metadata: unknown; text: string; version: string }>;
  export default pdfParse;
}
