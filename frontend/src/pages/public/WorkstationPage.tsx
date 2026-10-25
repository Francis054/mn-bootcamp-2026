import { usePageMeta } from '@/components/SiteChrome';
import { WorkstationApp } from '@/workstation/WorkstationApp';
import '@/styles/workstation.css';

export function WorkstationPage() {
  usePageMeta('Learning workstation');
  return <WorkstationApp />;
}
