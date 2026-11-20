import { createContext } from 'react';

/**
 * Pratinjau (Kelola › Form): the member's form as its maker sees it. Nothing is read from or kept on the device, and
 * nothing reaches the server, not even a picked file.
 */
export const PreviewMode = createContext(false);

/** A file picked in Pratinjau stays on the device: an address that reads as its name, as a stored file's does. */
export const previewFile = (file: File) =>
  `pratinjau/0-${encodeURIComponent(file.name)}`;
