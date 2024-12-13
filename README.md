# Welcome to ScreenWise - Eligibility Extractor
## Overview
ScreenWise: Eligibility Extractor is Part 1 of centralizing eligibility screening for benefit programs. 

## Implementation Playbook
[Playbook](https://docs.google.com/document/d/1mLIkvu0CKIha_GlfXRuO-qIAXUEFc8qT/edit)  (Contains specific information about ScreenWise, including a highly detailed deployment guide) 

## Getting Started
### Prerequisites
Before you begin, ensure you have the following installed:

* Node.js (version 14.x or later)
* AWS CDK
* Python (for Lambda functions)
* AWS CLI configured with your AWS credentials

### Development
Clone the repository and check all pre-requisites.

### Useful commands
* `git clone <Github url>` clone the repo
* `npm run build` compile typescript to js
* `npm run watch` watch for changes and compile
* `npm run test` perform the jest unit tests
* `npx cdk deploy` deploy this stack to your default AWS account/region
* `npx cdk diff` compare deployed stack with current state
* `npx cdk synth` emits the synthesized CloudFormation template
* `npm i` Install dependencies
### Deployment Instructions:
* Change the constants in `lib/constants.ts`!
* Deploy with `npm run build && npx cdk deploy [stack name from constants.ts]`
* Configure Cognito using the CDK outputs

## Contributing
### Contributions are welcome! Please follow these steps:

* Fork the repository.
* Create a new branch (git checkout -b feature/YourFeature).
* Make your changes and commit them (git commit -m 'Add some feature').
* Push to the branch (git push origin feature/YourFeature).
* Open a pull request.
### Developers
* Sarah Klute
* Rishabh Saxena
