import { ICON_PATHS, type IconName } from './iconPaths';

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg className={`i ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}

export type { IconName };
