import {
  S3Client,
  PutObjectCommand
} from "@aws-sdk/client-s3";

import {
  getSignedUrl
} from "@aws-sdk/s3-request-presigner";

const BUCKET =
  process.env.UPLOAD_BUCKET;

const REGION =
  process.env.REGION;

const URL_EXPIRATION = 300;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

if (!BUCKET || !REGION) {

  throw new Error(
      "Missing required environment variables"
  );
}

const s3 = new S3Client({
  region: REGION
});

export const handler = async (event) => {

  try {

      // Parse request body
      const body =
          typeof event.body === "string"
              ? JSON.parse(event.body)
              : event.body ?? event;

      const {
          content_type
      } = body;

      // Validate content type
      if (!content_type) {

          return response(
              400,
              {
                  error:
                      "Missing content_type"
              }
          );
      }

      // Validate allowed image types
      if (
          !ALLOWED_TYPES.includes(content_type)
      ) {

          return response(
              400,
              {
                  error:
                      `Unsupported file type: ${content_type}`
              }
          );
      }

      // Determine extension
      let extension = "jpg";

      if (content_type === "image/png") {
          extension = "png";
      }

      if (content_type === "image/webp") {
          extension = "webp";
      }

      // Generate timestamp filename
      const timestamp = Date.now();

      const key =
          `face-captures/${timestamp}.${extension}`;

      // Create PUT command
      const command =
          new PutObjectCommand({
              Bucket: BUCKET,
              Key: key,
              ContentType: content_type
          });

      // Generate signed URL
      const uploadUrl =
          await getSignedUrl(
              s3,
              command,
              {
                  expiresIn:
                      URL_EXPIRATION
              }
          );

      return response(
          200,
          {
              upload_url: uploadUrl,

              object_key: key,

              expires_in:
                  URL_EXPIRATION
          }
      );

  } catch (err) {

      console.error(
          "Presign Error:",
          err
      );

      return response(
          500,
          {
              error:
                  "Internal server error"
          }
      );
  }
};

function response(statusCode, body) {

  return {

      statusCode,

      headers: {

          "Access-Control-Allow-Origin":
              process.env.CORS_ALLOW_ORIGIN,

          "Access-Control-Allow-Headers":
              process.env.CORS_ALLOW_HEADERS,

          "Access-Control-Allow-Methods":
              process.env.CORS_ALLOW_METHODS,

          "Content-Type":
              "application/json"
      },

      body: JSON.stringify(body)
  };
}