/** Read legacy single-level cells and comma-separated multi-level cells. */
export function classLevels(value) {
  return typeof value==='string' ? [...new Set(value.split(',').map(level=>level.trim()).filter(Boolean))] : [];
}
export function toggleClassLevel(value,level,checked) {
  const selected=classLevels(value);
  return (checked?[...new Set([...selected,level])]:selected.filter(item=>item!==level)).join(', ');
}
