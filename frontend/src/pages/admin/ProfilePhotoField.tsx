import { useEffect, useRef, useState, type RefObject } from 'react';
import { Field } from '@/components/controls';
import { previewPhotoUrl, profilePhotoFileProblem, readFileBytes, sniffedPhotoMime } from '@/domain/photo';

interface StagedPhoto {
  file: File;
  photoUrl: string;
  storageKey: string;
}

export interface PreparedPhoto {
  photoUrl: string | null;
  photoStorageKey: string | null;
}

export function useProfilePhoto(initialUrl: string | null) {
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const [problem, setProblem] = useState<string | undefined>();
  const savedUrl = useRef<string | null>(initialUrl);
  const fileRef = useRef<File | null>(null);
  const removedRef = useRef(false);
  const objectUrl = useRef<string | null>(null);
  const staged = useRef<StagedPhoto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const clearObjectUrl = () => {
    if (!objectUrl.current) return;
    URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  };

  const rejectFile = (message: string) => {
    clearObjectUrl();
    staged.current = null;
    fileRef.current = null;
    setPreview(removedRef.current ? null : savedUrl.current);
    setProblem(message);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const sizeProblem = profilePhotoFileProblem(file);
    if (sizeProblem) {
      rejectFile(sizeProblem);
      return;
    }
    const bytes = await readFileBytes(file);
    if (!sniffedPhotoMime(bytes)) {
      rejectFile('Use a JPEG, PNG, or WebP image.');
      return;
    }
    clearObjectUrl();
    staged.current = null;
    fileRef.current = file;
    removedRef.current = false;
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    setPreview(url);
    setProblem(undefined);
  };

  const remove = () => {
    clearObjectUrl();
    staged.current = null;
    fileRef.current = null;
    removedRef.current = true;
    setPreview(null);
    setProblem(undefined);
    if (inputRef.current) inputRef.current.value = '';
  };

  const prepare = async (
    upload: (file: File) => Promise<{ photoUrl: string; storageKey: string }>,
  ): Promise<PreparedPhoto | undefined> => {
    const file = fileRef.current;
    if (file) {
      if (!staged.current || staged.current.file !== file) {
        const uploaded = await upload(file);
        staged.current = { file, photoUrl: uploaded.photoUrl, storageKey: uploaded.storageKey };
      }
      return { photoUrl: staged.current.photoUrl, photoStorageKey: staged.current.storageKey };
    }
    if (removedRef.current) return { photoUrl: null, photoStorageKey: null };
    return undefined;
  };

  const finish = (saved: string | null) => {
    clearObjectUrl();
    staged.current = null;
    fileRef.current = null;
    removedRef.current = false;
    savedUrl.current = saved;
    setPreview(saved);
    setProblem(undefined);
    if (inputRef.current) inputRef.current.value = '';
  };

  return { preview, problem, inputRef, onFile, remove, prepare, finish };
}

export function ProfilePhotoField({
  preview,
  displayName,
  error,
  disabled,
  inputRef,
  onFile,
  onRemove,
}: {
  preview: string | null;
  displayName: string;
  error?: string;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  const shown = previewPhotoUrl(preview);
  return (
    <Field
      id="photoUrl"
      label="Profile photo"
      required={false}
      error={error}
      className="span-2"
      hint="JPEG, PNG, or WebP. At most 5 MB. It is stored when you save the profile."
    >
      <div className="profile-photo-field">
        {shown ? (
          <img className="profile-photo-field__img" src={shown} alt={displayName || 'Profile photo'} />
        ) : (
          <span className="profile-photo-field__empty">No photo yet</span>
        )}
        <div className="profile-photo-field__actions">
          <button className="btn btn--dark btn--sm" type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>
            {shown ? 'Replace photo' : 'Upload photo'}
          </button>
          {shown ? (
            <button className="btn btn--ghost btn--sm" type="button" disabled={disabled} onClick={onRemove}>
              Remove photo
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          id="photoUrl"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            onFile(file);
          }}
        />
      </div>
    </Field>
  );
}
