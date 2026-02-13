export const $ = (id) => document.getElementById(id);

export function getPianoEl() {
  return $('piano');
}

export function getMelodyDisplay() {
  return $('melody-display');
}
