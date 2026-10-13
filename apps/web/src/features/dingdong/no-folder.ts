import { toast } from '~/components/garis';
import { dingdong as copy } from '~/copy/dingdong';
import { fill } from '~/copy/fill';

/** "Folder Ding Dong untuk IF4010 belum tersedia." (the prototype's `drive` action), for a course without a folder. */
export const noFolderToast = (code: string) =>
  toast.success(fill(copy.folderBelumTersedia, { kode: code }));
