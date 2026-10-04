/**
 * The PDF writer is twice the size of the viewer and only needed at the moment
 * a file is saved, so it is fetched then — opening and looking stay light.
 */
export const pdfLib = () => import('@cantoo/pdf-lib')
