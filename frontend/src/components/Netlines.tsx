import markup from './netlines.svg?raw';

export function Netlines() {
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: markup }} />;
}
