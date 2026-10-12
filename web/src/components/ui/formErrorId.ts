/** The id of a form's error message, derived from the form's name so the screen and its FormError agree. */
export function formErrorId(form: string): string {
  return `${form}-error`;
}
