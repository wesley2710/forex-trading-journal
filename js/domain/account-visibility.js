export function visibleAccounts(db, includeArchived = false) {
  return (db.accounts || []).filter((account) => includeArchived || !account.archived);
}

export function visibleAccountIds(db, includeArchived = false) {
  return new Set(visibleAccounts(db, includeArchived).map((account) => account.id));
}

export function visibleAccountRecords(db, records = [], { includeArchived = false, selected = 'all' } = {}) {
  const ids = visibleAccountIds(db, includeArchived);
  return records.filter((item) => ids.has(item.accountId) && (selected === 'all' || item.accountId === selected));
}
