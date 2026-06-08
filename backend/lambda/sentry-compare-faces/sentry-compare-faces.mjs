import { RekognitionClient, SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const rekognition = new RekognitionClient({ region: process.env.AWS_REGION });

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

const COLLECTION_ID = process.env.COLLECTION_ID;
const TABLE_NAME = process.env.ATTENDANCE_LOG_TABLE;

const FACE_MATCH_THRESHOLD = 80;
const MAX_FACES = 1;

export const handler = async (event) => {
  try {
    console.log("Incoming SNS Event:", JSON.stringify(event, null, 2));

    for (const snsRecord of event.Records) {
      const snsMessage = JSON.parse(snsRecord.Sns.Message);

      for (const s3Record of snsMessage.Records) {
        const bucket = s3Record.s3.bucket.name;

        const key = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, " "));

        console.log(`Bucket: ${bucket}`);
        console.log(`Key: ${key}`);

        /*
          Expected format: face-captures/{event_type}/{attendance_id}.jpg
        */

        const keyParts = key.split("/");

        if (keyParts.length !== 3) {
          console.error(`Invalid key format: ${key}`);
          continue;
        }

        const eventType = keyParts[1];
        const fileName = keyParts[2];

        const attendanceId = fileName.substring(0, fileName.lastIndexOf("."));

        console.log({ eventType, attendanceId });

        let employeeId = null;
        let confidence = null;
        let status = "failed";

        try {
          const command =new SearchFacesByImageCommand({
              CollectionId: COLLECTION_ID,
              Image: {
                S3Object: {
                  Bucket: bucket,
                  Name: key,
                },
              },
              FaceMatchThreshold:FACE_MATCH_THRESHOLD,
              MaxFaces: MAX_FACES,
          });

          const response = await rekognition.send(command);

          console.log("Rekognition Response:", JSON.stringify(response, null, 2));

          if (response.FaceMatches && response.FaceMatches.length > 0) {
            const bestMatch = response.FaceMatches[0];
            employeeId = bestMatch.Face.ExternalImageId;
            confidence = bestMatch.Similarity;
            status = "success";
          }

        } catch (error) {
          console.error("Rekognition Error:",error);
          status = "timeout";
        }

        await dynamodb.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {attendance_id: attendanceId,},
            UpdateExpression: `
              SET
                employee_id = :employee_id,
                confidence = :confidence,
                #status = :status,
                completed_at = :completed_at
            `,
            ExpressionAttributeNames: {"#status": "status"},
            ExpressionAttributeValues: {
              ":employee_id": employeeId,
              ":confidence": confidence,
              ":status": status,
              ":completed_at":
                new Date().toISOString(),
            },
            ConditionExpression:
              "attribute_exists(attendance_id)",
          })
        );

        console.log(`Attendance updated: ${attendanceId}`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
      }),
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};