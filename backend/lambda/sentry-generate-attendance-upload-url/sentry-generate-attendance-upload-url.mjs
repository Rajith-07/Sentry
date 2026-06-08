import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const BUCKET = process.env.UPLOAD_BUCKET;
const REGION = process.env.REGION;
const TABLE_NAME = process.env.ATTENDANCE_TABLE;

const URL_EXPIRATION = 300;

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

const ALLOWED_EVENT_TYPES = [
    "CLOCK_IN",
    "CLOCK_OUT"
];

if (!BUCKET || !REGION || !TABLE_NAME) {
    throw new Error(
        "Missing required environment variables"
    );
}

const s3 = new S3Client({ region: REGION });

const dynamoClient = new DynamoDBClient({ region: REGION });
const dynamo = DynamoDBDocumentClient.from( dynamoClient );

export const handler = async (event) => {
    try {
        // Parse request body
        const body = typeof event.body === "string" ? JSON.parse(event.body): event.body ?? event;

        const { content_type, event_type } = body;

        // Validate content type
        if (!content_type) {
            return response(400, {error: "Missing content_type"});
        }

        // Validate event type
        if (!event_type) {
            return response(400, {error: "Missing event_type"});
        }

        // Validate allowed image types
        if (!ALLOWED_TYPES.includes(content_type)) {
            return response(400,{error:`Unsupported file type: ${content_type}`});
        }

        // Validate event type
        if (!ALLOWED_EVENT_TYPES.includes(event_type)) {
            return response(400, {error:`Unsupported event type: ${event_type}`});
        }

        // Determine extension
        let extension = "jpg";

        if (content_type === "image/png") {
            extension = "png";
        }

        if (content_type === "image/webp") {
            extension = "webp";
        }

        // Generate attendance/job ID
        const attendance_id = crypto.randomUUID();

        // Created timestamp
        const created_at = new Date().toISOString();

        // Better S3 object key
        const key = `face-captures/${event_type}/${attendance_id}.${extension}`;

        // Insert pending attendance record
        await dynamo.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    attendance_id,
                    event_type,
                    status: "pending",
                    created_at
                }
            })
        );

        // Create presigned PUT command
        const command =
            new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                ContentType: content_type
            });

        // Generate presigned upload URL
        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: URL_EXPIRATION });

        return response(200,
            {
                attendance_id,
                upload_url: uploadUrl,
                object_key: key,
                expires_in:URL_EXPIRATION
            }
        );

    } catch (err) {
        console.error("Presign Error:", err);
        return response(500, {error:"Internal server error"});
    }
};

function response(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN,
            "Access-Control-Allow-Headers": process.env.CORS_ALLOW_HEADERS,
            "Access-Control-Allow-Methods": process.env.CORS_ALLOW_METHODS,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    };
}