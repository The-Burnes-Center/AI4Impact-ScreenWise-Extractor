import {
  ContentLayout,
  Header,
  Cards,
  Container,
  SpaceBetween,
  Link,
  BreadcrumbGroup,
} from "@cloudscape-design/components";
import BaseAppLayout from "../components/base-app-layout";
import RouterButton from "../components/wrappers/router-button";
import useOnFollow from "../common/hooks/use-on-follow";
import { CHATBOT_NAME } from "../common/constants";

export default function Welcome() {
  const onFollow = useOnFollow();

  return (
    <BaseAppLayout
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: CHATBOT_NAME,
              href: "/",
            },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="An open-source, free-to-use screener builder."
              actions={
                <RouterButton
                  iconAlign="right"
                  iconName="contact"
                  variant="primary"
                  href="/admin/data"
                >
                  Get Started!
                </RouterButton>
              }
            >
              Home
            </Header>
          }
        >
          <SpaceBetween size="l">
            <Container
              // media={{
              //   content: (
              //     <img src="/images/welcome/ui-dark.png" alt="placeholder" />
              //   ),
              //   width: 300,
              //   position: "side",
              // }}
            >
              <Header
                variant="h1"
                description="Upload, Extract, Build"
              >
                Welcome to the Eligibility Extractor!
              </Header>
              <p>
                The web app is hosted on{" "}
                <Link external href="https://aws.amazon.com/s3/">
                  Amazon S3
                </Link>{" "}
                behind{" "}
                <Link external href="https://aws.amazon.com/cloudfront/">
                  Amazon CloudFront
                </Link>{" "}
                with{" "}
                <Link external href="https://aws.amazon.com/cognito/">
                  Cognito Authentication
                </Link>{" "}
                to help you interact and experiment with{" "}
                <strong>multiple Models</strong>,{" "}
                <strong>multiple RAG sources</strong>,{" "}
                <strong>conversational history support</strong> and{" "}
                <strong>documents upload</strong>.
              </p>
              <p>
                The interface layer between the UI and backend is build on top
                of{" "}
                <Link
                  external
                  href="https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html"
                >
                  Amazon API Gateway WebSocket APIs
                </Link>
                <br />
                Build on top of{" "}
                <Link external href="https://cloudscape.design/">
                  AWS Cloudscape design system
                </Link>
              </p>
            </Container>
          </SpaceBetween>
        </ContentLayout>
      }
    ></BaseAppLayout>
  );
}
