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
              description="An open-source, free-to-use RAG tool"
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
              The Eligibility Extractor is a free-to-use tool that allows you to upload various data sources and extract eligibility criteria from them! In combination with
                <Link external href="https://github.com/The-Burnes-Center/Eligibility_Screener/tree/main">{" "}
                our partner screener builder
                </Link>{" "}
                you can build your own eligibility screener with just program information!
              </p>
              <p>
                Get started by uploading your data sources with the "Get Started" button.
              </p>
            </Container>
          </SpaceBetween>
        </ContentLayout>
      }
    ></BaseAppLayout>
  );
}
