/**
 * The PDF writer is twice the size of the viewer and only needed at the moment
 * a file is saved, so it is fetched then — opening and looking stay light.
 */
export const pdfLib = () => import('@cantoo/pdf-lib')

/** Noto Sans for text the standard PDF fonts cannot write; fetched only when such text is saved. */
export const notoSans = () =>
  fetch(`${import.meta.env.BASE_URL}fonts/NotoSans-Regular.ttf`).then((response) => response.arrayBuffer())
