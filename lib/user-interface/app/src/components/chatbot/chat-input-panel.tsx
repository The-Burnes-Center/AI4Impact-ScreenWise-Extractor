import {
  Button,
  Container,
  Icon,
  Select,
  SelectProps,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Checkbox
} from "@cloudscape-design/components";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { Auth } from "aws-amplify";
import TextareaAutosize from "react-textarea-autosize";
import { ReadyState } from "react-use-websocket";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import styles from "../../styles/chat.module.scss";
import {  
  ChatBotHistoryItem,  
  ChatBotMessageType,
  ChatInputState,  
} from "./types";
import {  
  assembleHistory
} from "./utils";
import { Utils } from "../../common/utils";
import {SessionRefreshContext} from "../../common/session-refresh-context"
import { useNotifications } from "../notif-manager";
//import AWS from '../../../../public/aws-exports.json'; - SARAH testing

export interface ChatInputPanelProps {
  running: boolean;
  setRunning: Dispatch<SetStateAction<boolean>>;
  session: { id: string; loading: boolean };
  messageHistory: ChatBotHistoryItem[];
  setMessageHistory: (history: ChatBotHistoryItem[]) => void;  
}

export abstract class ChatScrollState {
  static userHasScrolled = false;
  static skipNextScrollEvent = false;
  static skipNextHistoryUpdate = false;
}

export default function ChatInputPanel(props: ChatInputPanelProps) {
  const appContext = useContext(AppContext);
  const {needsRefresh, setNeedsRefresh} = useContext(SessionRefreshContext);
  //the stage of the chatbot that we are in (1st: Start, 2nd: Decision Tree made, 3rd: Eligbibilty Screener made)
  const { transcript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const [state, setState] = useState<ChatInputState>({
    value: "",
  });
  const { notifications, addNotification } = useNotifications();
  const [readyState, setReadyState] = useState<ReadyState>(
    ReadyState.OPEN
  );  
  const messageHistoryRef = useRef<ChatBotHistoryItem[]>([]);
  const [
    selectedDataSource,
    setSelectedDataSource
  ] = useState({ label: "Bedrock Knowledge Base", value: "kb" } as SelectProps.ChangeDetail["selectedOption"]);
  useEffect(() => {
    messageHistoryRef.current = props.messageHistory;    
  }, [props.messageHistory]);
  
  /** checkboxes */
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  /** Speech recognition */
  useEffect(() => {
    if (transcript) {
      setState((state) => ({ ...state, value: transcript }));
    }
  }, [transcript]);

  /**Some amount of auto-scrolling for convenience */
  useEffect(() => {
    const onWindowScroll = () => {
      if (ChatScrollState.skipNextScrollEvent) {
        ChatScrollState.skipNextScrollEvent = false;
        return;
      }
      const isScrollToTheEnd =
        Math.abs(
          window.innerHeight +
          window.scrollY -
          document.documentElement.scrollHeight
        ) <= 10;
      if (!isScrollToTheEnd) {
        ChatScrollState.userHasScrolled = true;
      } else {
        ChatScrollState.userHasScrolled = false;
      }
    };
    window.addEventListener("scroll", onWindowScroll);
    return () => {
      window.removeEventListener("scroll", onWindowScroll);
    };
  }, []);
  useLayoutEffect(() => {
    if (ChatScrollState.skipNextHistoryUpdate) {
      ChatScrollState.skipNextHistoryUpdate = false;
      return;
    }
    if (!ChatScrollState.userHasScrolled && props.messageHistory.length > 0) {
      ChatScrollState.skipNextScrollEvent = true;
      window.scrollTo({
        top: document.documentElement.scrollHeight + 1000,
        behavior: "instant",
      });
    }
  }, [props.messageHistory]);

  /** Sends a message to the chat API */
  const handleSendMessage = async () => {
    if (props.running) return;
    if (readyState !== ReadyState.OPEN) return;
    ChatScrollState.userHasScrolled = false;
    let username;
    await Auth.currentAuthenticatedUser().then((value) => username = value.username);
    if (!username) return;    

    let userMessage = "Extracting JSON from the knowledge documents provided...";
    let messageTemporary = `
    You are tasked with generating a structured JSON for program eligibility that includes programs, criteria, and questions. Follow these updated guidelines:
    JSON Structure
    Put <json></json> tags around the JSON data.
    Programs Section:
    Include: id, name, estimated_savings, application_link, and criteria_ids.
    Criteria Section:
    Include: id, type (number, boolean, option), category, description, and relevant fields like threshold_by_household_size (for income) or options (for categorical criteria).
    Questions Section:
    Include: question, type, input_type, criteria_impact (mapping to programs and criteria), and options (only for dropdown questions).
    Key Refinements
    Use strings for estimated_savings with descriptions (e.g., "Up to $150/month").
    Ensure clear, program-specific descriptions for all criteria.
    Exclude options for boolean questions unless clarifying labels are necessary.
    Verify threshold_by_household_size values align with legal guidelines.
    Ensure all criteria links in criteria_ids are logically complete for each program.
    Use consistent terminology and formatting across all sections.
    {
      "programs": [...],
      "criteria": [...],
      "questions": [...]
    }
    Use the following guidelines when generating the JSON:

    Use the exact key names, nesting, and types as shown.
    Ensure logical linking between questions and the programs/criteria they impact.
    Include realistic examples for threshold_by_household_size, options, and descriptions for each criterion.
    Refer to the following document details and convert them into a JSON structure that adheres strictly to the format and specifications above. Generate the JSON accurately and comprehensively, using placeholder text only when explicitly specified.`;
      
    setState({ value: "" });    
    const messageToSend = messageTemporary;

    try {
      props.setRunning(true);
      let receivedData = '';    
    

      /** Add the user's query to the message history and a blank dummy message for the chatbot as the response loads */
      messageHistoryRef.current = [
        ...messageHistoryRef.current,
        {
          type: ChatBotMessageType.Human,
          content: userMessage, 
          metadata: {},
        },
        {
          type: ChatBotMessageType.AI,          
          content: receivedData,
          metadata: {},
        },
      ];
      
      props.setMessageHistory(messageHistoryRef.current);
      let firstTime = false;
      if (messageHistoryRef.current.length < 3) {
        firstTime = true;
      }

      const TEST_URL = appContext.wsEndpoint + "/";
      const TOKEN = await Utils.authenticate();
      const wsUrl = TEST_URL + '?Authorization=' + TOKEN;
      const ws = new WebSocket(wsUrl);
      let incomingMetadata = false;
      let sources = {};

      /** If there is no response after a minute, time out the response to try again. */
      setTimeout(() => {
        if (receivedData == '') {
          ws.close();
          messageHistoryRef.current.pop();
          messageHistoryRef.current.push({
            type: ChatBotMessageType.AI,          
            content: 'Response timed out!',
            metadata: {},
          });
        }
      }, 120000);

      // Event listener for when the connection is open
      ws.addEventListener('open', function open() {
        console.log('Connected to the WebSocket server');        
        const message = JSON.stringify({
          "action": "getChatbotResponse",
          "data": {
            userMessage: messageToSend,
            chatHistory: assembleHistory(messageHistoryRef.current.slice(0, -2)),
            systemPrompt: `You are a skilled assistant tasked with creating a JSON structure to represent program eligibility criteria in your knowledge base, associated questions, and program details based on provided information. You always put <json></json> tags around JSON data.`,
            projectId: 'rsrs111111',
            user_id: username,
            session_id: props.session.id,
            retrievalSource: selectedDataSource.value
          }
        });
        ws.send(message);
      });

      // Event listener for incoming messages
      ws.addEventListener('message', async function incoming(data) {
        if (data.data.includes("<!ERROR!>:")) {
          addNotification("error", data.data);          
          ws.close();
          return;
        }

        if (data.data == '!<|EOF_STREAM|>!') {          
          incomingMetadata = true;
          return;          
        }

        if (!incomingMetadata) {
          receivedData += data.data;
        } else {
          let sourceData = JSON.parse(data.data);
          sourceData = sourceData.map((item) => {
            if (item.title == "") {
              return { title: item.uri.slice((item.uri as string).lastIndexOf("/") + 1), uri: item.uri };
            } else {
              return item;
            }
          });
          sources = { "Sources": sourceData };
          console.log(sources);
        }

        // Update the chat history state with the new message        
        messageHistoryRef.current = [
          ...messageHistoryRef.current.slice(0, -2),
          {
            type: ChatBotMessageType.Human,
            content: userMessage,
            metadata: {},
          },
          {
            type: ChatBotMessageType.AI,            
            content: receivedData,
            metadata: sources,
          },
        ];        
        props.setMessageHistory(messageHistoryRef.current);
      });

      // Handle possible errors
      ws.addEventListener('error', function error(err) {
        console.error('WebSocket error:', err);
      });

      // Handle WebSocket closure
      ws.addEventListener('close', async function close() {
        if (firstTime) {             
          Utils.delay(1500).then(() => setNeedsRefresh(true));
        }
        props.setRunning(false);        
        console.log('Disconnected from the WebSocket server');
      });
    } catch (error) {      
      console.error('Error sending message:', error);
      alert('Sorry, something has gone horribly wrong! Please try again or refresh the page.');
      props.setRunning(false);
    } 
  };

  const handleCheckboxChange = (option: string) => {
    setSelectedOptions((prevSelectedOptions) =>
      prevSelectedOptions.includes(option)
        ? prevSelectedOptions.filter((o) => o !== option)
        : [...prevSelectedOptions, option]
    );
  };

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const handleDownloadJson = () => {
    const aiMessages = props.messageHistory.filter(
      (message) => message.type === ChatBotMessageType.AI
    );

    const jsonMessage = aiMessages.find((message) =>
      message.content.includes("<json>") && message.content.includes("</json>")
    );

    if (!jsonMessage) {
      addNotification("error", "JSON not found.");     
      return;
    }

    const jsonData = jsonMessage.content.match(/<json>([\s\S]*?)<\/json>/)?.[1];

    if (!jsonData) {
      alert("Failed to extract JSON data.");
      return;
    }

    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SpaceBetween direction="horizontal" size="l">
      <Container>
        <div className={styles.input_textarea_container}>
          <Button onClick={handleSendMessage}>Extract</Button>
        </div>
        <div className={styles.input_textarea_container}>
          <Button onClick={handleDownloadJson}>Download File</Button>
        </div>
      </Container>
    </SpaceBetween>
  );
};