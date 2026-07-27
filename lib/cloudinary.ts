import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export type UploadResult = {
  cloudinaryId: string;
  url: string;
  width: number;
  height: number;
};

/**
 * Uploads a single image buffer to Cloudinary under a per-place folder.
 * Called only from admin actions and the ingestion pipeline — never from a
 * public-facing request.
 */
export async function uploadImageToCloudinary(
  fileBuffer: Buffer,
  placeSlug: string
): Promise<UploadResult> {
  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `smarttravel/places/${placeSlug}`,
        resource_type: "image",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, res) => (error ? reject(error) : resolve(res))
    );
    stream.end(fileBuffer);
  });

  return {
    cloudinaryId: result.public_id,
    url: result.secure_url,
    width: result.width,
    height: result.height,
  };
}

/** Uploads directly from a remote (licensed) source URL — used by ingestion. */
export async function uploadImageFromUrl(
  sourceUrl: string,
  placeSlug: string
): Promise<UploadResult> {
  const result = await cloudinary.uploader.upload(sourceUrl, {
    folder: `smarttravel/places/${placeSlug}`,
    resource_type: "image",
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  });

  return {
    cloudinaryId: result.public_id,
    url: result.secure_url,
    width: result.width,
    height: result.height,
  };
}

export async function deleteImageFromCloudinary(cloudinaryId: string) {
  await cloudinary.uploader.destroy(cloudinaryId);
}

export default cloudinary;
