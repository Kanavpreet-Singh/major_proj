import { createUploadthing, type FileRouter } from 'uploadthing/next';

const f = createUploadthing();

export const fileRouter = {
  imageUploader: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(async () => {
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      console.log('Upload complete:', file.url);
      return { url: file.url };
    }),
} satisfies FileRouter;

export type AppFileRouter = typeof fileRouter;
