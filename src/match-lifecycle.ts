export interface MatchCommit {
  ids: number[];
  at: number;
  shot: number;
}
/** Contact dwell, committed celebrations, and reset are one explicit lifecycle. */
export class MatchLifecycle {
  private pending = new Map<string, number>();
  private committed: MatchCommit[] = [];
  get size() {
    return this.committed.length;
  }
  observe(groups: number[][], now: number, shot: number): MatchCommit[] {
    const active = new Set<string>();
    const reserved = new Set(this.committed.flatMap((group) => group.ids));
    const armed: MatchCommit[] = [];
    for (const group of groups) {
      const ids = [...new Set(group)].sort((a, b) => a - b);
      if (ids.length < 3 || ids.some((id) => reserved.has(id))) continue;
      const key = ids.join(",");
      active.add(key);
      const since = this.pending.get(key);
      if (since === undefined) {
        this.pending.set(key, now);
        continue;
      }
      if (now - since < 0.16) continue;
      const commit = { ids, at: now, shot };
      this.committed.push(commit);
      armed.push(commit);
      ids.forEach((id) => reserved.add(id));
      this.pending.delete(key);
    }
    for (const key of this.pending.keys())
      if (!active.has(key)) this.pending.delete(key);
    return armed;
  }
  takeReady(now: number): MatchCommit[] {
    const ready = this.committed.filter((group) => now - group.at >= 0.3);
    this.committed = this.committed.filter((group) => now - group.at < 0.3);
    return ready;
  }
  reset() {
    this.pending.clear();
    this.committed = [];
  }
}
