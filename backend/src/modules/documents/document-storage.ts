/**
 * Private file storage for trainee CVs.
 * The hosted site uses a private Supabase Storage bucket.
 * Development and tests use memory. Production without the Supabase settings refuses uploads.
 * This object never returns a public URL. The API streams the PDF itself.
 */
export interface StoredDocument {
  key: string;
}

export interface DocumentStorage {
  readonly name: 'memory' | 'supabase' | 'unconfigured';
  put(input: { bytes: Buffer; contentType: string }): Promise<StoredDocument>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
