import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  GetCommand
} from "@aws-sdk/lib-dynamodb";

const BUCKET = process.env.UPLOAD_BUCKET;
const REGION = process.env.REGION;
const EMPLOYEES_TABLE = process.env.EMPLOYEES_TABLE;

const URL_EXPIRATION = 300;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

if (
  !BUCKET ||
  !REGION ||
  !EMPLOYEES_TABLE
) {
  throw new Error(
    "Missing required environment variables"
  );
}

const s3 = new S3Client({
  region: REGION
});

const dynamodb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: REGION
  })
);

export const handler = async (event) => {

  try {

    // Extract employee_id from API Gateway path
    const employee_id =
      event.pathParameters?.employee_id;

    // Parse request body
    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body)
        : event.body ?? event;

    const {
      content_type
    } = body;

    // Validate employee_id
    if (!employee_id) {

      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: "Missing employee_id in path"
        })
      };
    }

    // Validate content_type
    if (!content_type) {

      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: "Missing content_type"
        })
      };
    }

    // Validate employee_id format
    if (!employee_id.startsWith("EMP")) {

      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: "Invalid employee_id format"
        })
      };
    }

    // Validate allowed image types
    if (!ALLOWED_TYPES.includes(content_type)) {

      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({
          error:
            `Unsupported file type: ${content_type}`
        })
      };
    }

    // =========================
    // DynamoDB Employee Check
    // =========================

    const employeeResult =
      await dynamodb.send(
        new GetCommand({
          TableName: EMPLOYEES_TABLE,
          Key: {
            employee_id
          }
        })
      );

    // Employee does not exist
    if (!employeeResult.Item) {

      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: "Employee does not exist"
        })
      };
    }

    // =========================
    // Extension Mapping
    // =========================

    let extension = "jpg";

    if (content_type === "image/png") {
      extension = "png";
    }

    if (content_type === "image/webp") {
      extension = "webp";
    }

    // Deterministic S3 object path
    const key =
      `face-registry/${employee_id}.${extension}`;

    // Create S3 PUT command
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: content_type
    });

    // Generate pre-signed URL
    const uploadUrl =
      await getSignedUrl(
        s3,
        command,
        {
          expiresIn: URL_EXPIRATION
        }
      );

    // Success response
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        upload_url: uploadUrl,
        object_key: key,
        expires_in: URL_EXPIRATION
      })
    };

  } catch (err) {

    console.error(
      "Generate Upload URL Error:",
      err
    );

    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: err.message
      })
    };
  }
};

function corsHeaders() {

  return {
    "Access-Control-Allow-Origin":
      process.env.CORS_ALLOW_ORIGIN,

    "Access-Control-Allow-Headers":
      process.env.CORS_ALLOW_HEADERS,

    "Access-Control-Allow-Methods":
      process.env.CORS_ALLOW_METHODS,

    "Content-Type": "application/json"
  };
}