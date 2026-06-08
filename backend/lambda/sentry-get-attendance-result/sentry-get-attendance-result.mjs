import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION;
const TABLE_NAME = process.env.ATTENDANCE_TABLE;

if (!REGION || !TABLE_NAME) {
    throw new Error("Missing required environment variables");
}

const dynamoClient = new DynamoDBClient({ region: REGION });

const dynamo = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (event) => {
    try {
        // Extract attendance_id from path params
        const attendance_id = event?.pathParameters?.attendance_id;

        if (!attendance_id) {
            return response(400, { error: "Missing attendance_id" });
        }

        // Fetch attendance record
        const result = await dynamo.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { attendance_id }
            })
        );

        // Record not found
        if (!result.Item) {
            return response(404, { error: "Attendance record not found" });
        }

        const {
            event_type,
            confidence,
            status,
            employee_id
        } = result.Item;

        // Return only required fields
        return response(200, {
            attendance_id,
            event_type,
            confidence,
            status,
            employee_id
        });

    } catch (err) {
        console.error("Fetch Attendance Error:", err);

        return response(500, {
            error: "Internal server error"
        });
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