#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { RestAPIStack } from "../lib/rest-api-stack";
import { AuthAppStack } from '../lib/auth-app-stack';


const app = new cdk.App();
new AuthAppStack(app, "AwsServerlessAuthStack", { env: { region: "eu-west-1" } });
