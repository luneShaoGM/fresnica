// Display only: keep every significant decimal digit and the original value for actions.
export function formatHomeAmount(value: string): string {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return value;
  const [integer, fraction = ''] = value.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const significant = fraction.replace(/0+$/, '');
  return significant ? `${grouped}.${significant}` : grouped;
}
