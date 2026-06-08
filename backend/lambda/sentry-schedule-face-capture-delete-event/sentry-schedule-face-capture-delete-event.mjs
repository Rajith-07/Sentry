// const {
//     SchedulerClient,
//     CreateScheduleCommand
// } = require("@aws-sdk/client-scheduler");

// const scheduler = new SchedulerClient({});

// const DELETE_LAMBDA_ARN = process.env.DELETE_LAMBDA_ARN;
// const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN;

// exports.handler = async (event) => {

//     console.log("Received event:", JSON.stringify(event));

//     for (const record of event.Records) {

//         const bucket = record.s3.bucket.name;

//         const key = decodeURIComponent(
//             record.s3.object.key.replace(/\+/g, " ")
//         );

//         const deleteTime = new Date(
//             // Date.now() + 60 * 60 * 1000 // in ms
//             Date.now() + 10*1000 // 10 s
//         );

//         const scheduleName =
//             `delete-${Date.now()}-${Math.random()
//                 .toString(36)
//                 .substring(2, 8)}`;

//         await scheduler.send(
//             new CreateScheduleCommand({

//                 Name: scheduleName,

//                 ScheduleExpression:
//                     `at(${deleteTime.toISOString().split(".")[0]})`,

//                 FlexibleTimeWindow: {
//                     Mode: "OFF"
//                 },

//                 Target: {
//                     Arn: DELETE_LAMBDA_ARN,
//                     RoleArn: SCHEDULER_ROLE_ARN,

//                     Input: JSON.stringify({
//                         bucket,
//                         key
//                     })
//                 },

//                 ActionAfterCompletion: "DELETE"
//             })
//         );

//         console.log(`Scheduled deletion for ${key}`);
//     }

//     return {
//         statusCode: 200
//     };
// };




const {
    SchedulerClient,
    CreateScheduleCommand
} = require("@aws-sdk/client-scheduler");

const scheduler = new SchedulerClient({});

const DELETE_LAMBDA_ARN = process.env.DELETE_LAMBDA_ARN;
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN;

exports.handler = async (event) => {

    console.log("Received SNS event:", JSON.stringify(event, null, 2));

    for (const snsRecord of event.Records) {

        // SNS wraps original S3 event inside Message
        const snsMessage = JSON.parse(snsRecord.Sns.Message);

        console.log("Parsed S3 event:", JSON.stringify(snsMessage, null, 2));

        for (const s3Record of snsMessage.Records) {

            const bucket = s3Record.s3.bucket.name;

            const key = decodeURIComponent(
                s3Record.s3.object.key.replace(/\+/g, " ")
            );

            // Example: delete after 10 seconds
            const deleteTime = new Date(
                // Date.now() + 60 * 60 * 1000 // in ms
                Date.now() + 60 * 1000 // 60 s
            );

            // Schedule names must be unique
            const scheduleName =
                `delete-${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(2, 8)}`;

            const command = new CreateScheduleCommand({

                Name: scheduleName,

                ScheduleExpression:
                    `at(${deleteTime.toISOString().split(".")[0]})`,

                FlexibleTimeWindow: {
                    Mode: "OFF"
                },

                Target: {
                    Arn: DELETE_LAMBDA_ARN,
                    RoleArn: SCHEDULER_ROLE_ARN,

                    Input: JSON.stringify({
                        bucket,
                        key
                    })
                },

                ActionAfterCompletion: "DELETE"
            });

            await scheduler.send(command);

            console.log(`Scheduled deletion for: ${key}`);
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Schedules created successfully"
        })
    };
};