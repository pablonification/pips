import { common } from '~/copy/common';

/** An app's name as the consent page and Profil show it: its own name, or a fixed one when it gave none. */
export function appName(name: string) {
  return name.trim() || common.shell.aplikasiTanpaNama;
}
