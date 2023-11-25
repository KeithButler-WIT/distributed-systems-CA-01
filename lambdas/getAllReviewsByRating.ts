import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { MovieReviewQueryParams } from "../shared/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions["MovieReviewQueryParams"] || {}
);
 
const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", event);

    const parameters  = event?.pathParameters;
    const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;

    const queryParams = event.queryStringParameters;
    console.log("queryParams: ", queryParams);
    if (!queryParams) {
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing query parameters" }),
      };
    }
    if (!isValidQueryParams(queryParams)) {
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `Incorrect type. Must match Query parameters schema`,
          schema: schema.definitions["MovieReviewQueryParams"],
        }),
      };
    }
    
    // const parameters = event.queryStringParameters;
    const rating = queryParams.rating ? parseInt(queryParams.rating) : undefined;
    let commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
    };
    if ("minRating" in queryParams) {
      commandInput = {
        ...commandInput,
        IndexName: "reviewIx",
        KeyConditionExpression: "movieId = movieId and rating = rating",
        ExpressionAttributeValues: {
          movieId: movieId,
          rating: rating,
        },
      };
    } else {
        commandInput = {
          ...commandInput,
          KeyConditionExpression: "movieId = movieId",
          ExpressionAttributeValues: {
            movieId: movieId,
          },
        };
      }

    // const ddbDocClient = createDocumentClient();
    const commandOutput = await ddbDocClient.send(
        new QueryCommand(commandInput)
        );
        
        return {
          statusCode: 200,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            data: commandOutput.Items,
          }),
        };
      } catch (error: any) {
        console.log(JSON.stringify(error));
        return {
          statusCode: 500,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ error }),
        };
      }
    };
  
function createDocumentClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
  wrapNumbers: false,
};
const translateConfig = { marshallOptions, unmarshallOptions };
return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}