import type { PortfolioItemEntity } from './portfolio-item.entity.js';
import {
  emptyItem,
  isPortfolioKind,
  type ItemContent,
  type PortfolioKind,
} from './portfolio-rules.js';

export function liveContent(row: PortfolioItemEntity): ItemContent {
  return {
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    skills: row.skills,
    startedOn: row.startedOn,
    completedOn: row.completedOn,
    repositoryUrl: row.repositoryUrl,
    demoUrl: row.demoUrl,
  };
}

export function pendingContent(row: PortfolioItemEntity): ItemContent {
  if (!row.hasPending) return liveContent(row);
  const kind = row.pendingKind && isPortfolioKind(row.pendingKind) ? row.pendingKind : row.kind;
  return {
    kind,
    title: row.pendingTitle ?? '',
    summary: row.pendingSummary ?? '',
    skills: row.pendingSkills ?? [],
    startedOn: row.pendingStartedOn,
    completedOn: row.pendingCompletedOn,
    repositoryUrl: row.pendingRepositoryUrl,
    demoUrl: row.pendingDemoUrl,
  };
}

export function writePending(row: PortfolioItemEntity, content: ItemContent): void {
  row.hasPending = true;
  row.pendingKind = content.kind;
  row.pendingTitle = content.title;
  row.pendingSummary = content.summary;
  row.pendingSkills = content.skills;
  row.pendingStartedOn = content.startedOn;
  row.pendingCompletedOn = content.completedOn;
  row.pendingRepositoryUrl = content.repositoryUrl;
  row.pendingDemoUrl = content.demoUrl;
}

export function writeLive(row: PortfolioItemEntity, content: ItemContent): void {
  row.kind = content.kind;
  row.title = content.title;
  row.summary = content.summary;
  row.skills = content.skills;
  row.startedOn = content.startedOn;
  row.completedOn = content.completedOn;
  row.repositoryUrl = content.repositoryUrl;
  row.demoUrl = content.demoUrl;
}

export function clearPending(row: PortfolioItemEntity): void {
  row.hasPending = false;
  row.pendingKind = null;
  row.pendingTitle = null;
  row.pendingSummary = null;
  row.pendingSkills = null;
  row.pendingStartedOn = null;
  row.pendingCompletedOn = null;
  row.pendingRepositoryUrl = null;
  row.pendingDemoUrl = null;
}

export function freshPending(kind: PortfolioKind = 'project'): ItemContent {
  return emptyItem(kind);
}
