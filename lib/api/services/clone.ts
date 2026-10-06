/**
 * Name given to a cloned campaign or destination: the original name with
 * "(Clone)" added in brackets. The user can rename it afterwards.
 */
export function cloneName(name: string): string {
  return `${name} (Clone)`;
}